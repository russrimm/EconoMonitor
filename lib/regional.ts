import {
  readBoundedResponseJson,
  withDeadline,
} from './responseBody.ts';

export interface StateGdp {
  fips: string;
  name: string;
  period: string;
  value: number;
  changeOnQuarter: number | null;
  changeOnYear: number | null;
}

export interface CensusObservation {
  date: string;
  value: number;
}

export interface CensusIndicator {
  id: string;
  label: string;
  unit: string;
  note: string;
  latest: CensusObservation;
  changeOnMonth: number | null;
  changeOnYear: number | null;
  observations: CensusObservation[];
}

export interface RegionalResponse {
  stateGdp: {
    period: string;
    unit: string;
    states: StateGdp[];
  } | null;
  indicators: CensusIndicator[];
  updatedAt: string;
  partial: boolean;
  beaConfigured: boolean;
  censusConfigured: boolean;
}

/**
 * Census EITS datasets the app reads. `dataTypeCode` and `categoryCode` are the
 * dataset's own vocabulary, so each entry maps one published headline series.
 */
export const CENSUS_INDICATORS: readonly {
  id: string;
  dataset: string;
  categoryCode: string;
  dataTypeCode: string;
  label: string;
  unit: string;
  note: string;
}[] = [
  {
    id: 'retail-sales',
    dataset: 'marts',
    categoryCode: '44X72',
    dataTypeCode: 'SM',
    label: 'Advance retail and food services sales',
    unit: '$M',
    note: 'Seasonally adjusted, published about two weeks after month end.',
  },
  {
    id: 'housing-starts',
    dataset: 'resconst',
    categoryCode: 'TOTAL',
    dataTypeCode: 'STARTS',
    label: 'Housing starts',
    unit: 'thousands of units',
    note: 'Seasonally adjusted annual rate of new privately owned housing units started.',
  },
  {
    id: 'new-home-sales',
    dataset: 'ressales',
    categoryCode: 'TOTAL',
    dataTypeCode: 'SOLD',
    label: 'New single-family home sales',
    unit: 'thousands of units',
    note: 'Seasonally adjusted annual rate.',
  },
];

/** BEA writes numbers as display strings such as `"1,234.5"` or `"(NA)"`. */
export function parseBeaValue(value: unknown): number | null {
  if (typeof value !== 'string') {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '' || /^\(.*\)$/.test(cleaned)) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

/** BEA quarterly periods look like `2026Q1`; annual ones are bare years. */
export function isBeaPeriod(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}(Q[1-4])?$/.test(value.trim());
}

interface BeaRow {
  GeoFips?: unknown;
  GeoName?: unknown;
  TimePeriod?: unknown;
  DataValue?: unknown;
  CL_UNIT?: unknown;
}

function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Reduces the flat BEA row list to one entry per state for the latest period,
 * carrying quarter-on-quarter and year-on-year changes.
 */
export function parseStateGdp(payload: unknown): {
  period: string;
  unit: string;
  states: StateGdp[];
} {
  const results = (
    payload as { BEAAPI?: { Results?: { Data?: unknown } } } | null
  )?.BEAAPI?.Results;
  const rows = (results as { Data?: unknown } | undefined)?.Data;
  if (!Array.isArray(rows)) {
    throw new Error('upstream response did not contain BEA data rows');
  }

  const byState = new Map<
    string,
    { name: string; periods: Map<string, number> }
  >();
  const periods = new Set<string>();
  let unit = '';

  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as BeaRow;
    if (
      typeof row.GeoFips !== 'string' ||
      typeof row.GeoName !== 'string' ||
      !isBeaPeriod(row.TimePeriod)
    ) {
      continue;
    }

    const value = parseBeaValue(row.DataValue);
    if (value === null) continue;
    // The national aggregate is excluded so the map only carries states.
    if (row.GeoFips === '00000') continue;

    if (!unit && typeof row.CL_UNIT === 'string') unit = row.CL_UNIT;
    const period = row.TimePeriod.trim();
    periods.add(period);

    const state = byState.get(row.GeoFips) ?? {
      name: row.GeoName,
      periods: new Map<string, number>(),
    };
    state.periods.set(period, value);
    byState.set(row.GeoFips, state);
  }

  const orderedPeriods = [...periods].sort();
  const latestPeriod = orderedPeriods.at(-1);
  if (!latestPeriod) {
    throw new Error('BEA response contained no usable periods');
  }
  const priorPeriod = orderedPeriods.at(-2) ?? null;
  const yearAgoPeriod = orderedPeriods.at(-5) ?? null;

  const states: StateGdp[] = [];
  for (const [fips, state] of byState) {
    const value = state.periods.get(latestPeriod);
    if (value === undefined) continue;
    states.push({
      fips,
      name: state.name,
      period: latestPeriod,
      value,
      changeOnQuarter: percentChange(
        value,
        priorPeriod ? state.periods.get(priorPeriod) ?? null : null,
      ),
      changeOnYear: percentChange(
        value,
        yearAgoPeriod ? state.periods.get(yearAgoPeriod) ?? null : null,
      ),
    });
  }

  states.sort((left, right) => left.name.localeCompare(right.name));
  return { period: latestPeriod, unit, states };
}

/** Census EITS returns `YYYY-MM` (or `YYYY-MMM`) time labels. */
export function parseCensusPeriod(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/**
 * Census returns a header row followed by data rows, both as string arrays.
 * Column order is not guaranteed, so values are looked up by header name.
 */
export function parseCensusTimeseries(payload: unknown): CensusObservation[] {
  if (!Array.isArray(payload) || payload.length < 2) {
    throw new Error('upstream response was not a Census timeseries table');
  }

  const [header, ...rows] = payload;
  if (!Array.isArray(header)) {
    throw new Error('Census response header was malformed');
  }
  const valueIndex = header.indexOf('cell_value');
  const timeIndex = header.indexOf('time');
  if (valueIndex === -1 || timeIndex === -1) {
    throw new Error('Census response was missing cell_value or time');
  }

  const observations: CensusObservation[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const rawTime = row[timeIndex];
    const rawValue = row[valueIndex];
    if (typeof rawTime !== 'string' || typeof rawValue !== 'string') continue;

    const date = parseCensusPeriod(rawTime);
    const value = Number(rawValue.replace(/,/g, ''));
    if (!date || !Number.isFinite(value)) continue;
    observations.push({ date, value });
  }

  observations.sort((left, right) => left.date.localeCompare(right.date));
  return observations;
}

export function buildCensusIndicator(
  definition: (typeof CENSUS_INDICATORS)[number],
  observations: CensusObservation[],
): CensusIndicator | null {
  const latest = observations.at(-1);
  if (!latest) return null;

  const byDate = new Map(
    observations.map((observation) => [observation.date, observation.value]),
  );
  const latestDate = new Date(`${latest.date}T00:00:00Z`);
  const shift = (months: number): number | null => {
    const shifted = new Date(
      Date.UTC(
        latestDate.getUTCFullYear(),
        latestDate.getUTCMonth() - months,
        1,
      ),
    );
    const key = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-01`;
    return byDate.get(key) ?? null;
  };

  return {
    id: definition.id,
    label: definition.label,
    unit: definition.unit,
    note: definition.note,
    latest,
    changeOnMonth: percentChange(latest.value, shift(1)),
    changeOnYear: percentChange(latest.value, shift(12)),
    observations,
  };
}

export function isRegionalResponse(value: unknown): value is RegionalResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RegionalResponse>;

  if (candidate.stateGdp !== null) {
    if (typeof candidate.stateGdp !== 'object' || candidate.stateGdp === null) {
      return false;
    }
    if (
      typeof candidate.stateGdp.period !== 'string' ||
      !Array.isArray(candidate.stateGdp.states) ||
      !candidate.stateGdp.states.every(
        (state) =>
          typeof state === 'object' &&
          state !== null &&
          typeof state.fips === 'string' &&
          typeof state.name === 'string' &&
          typeof state.value === 'number',
      )
    ) {
      return false;
    }
  }

  return (
    Array.isArray(candidate.indicators) &&
    candidate.indicators.every(
      (indicator) =>
        typeof indicator === 'object' &&
        indicator !== null &&
        typeof indicator.id === 'string' &&
        typeof indicator.label === 'string' &&
        typeof indicator.latest === 'object' &&
        indicator.latest !== null &&
        typeof indicator.latest.date === 'string' &&
        typeof indicator.latest.value === 'number',
    ) &&
    typeof candidate.updatedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    typeof candidate.partial === 'boolean' &&
    typeof candidate.beaConfigured === 'boolean' &&
    typeof candidate.censusConfigured === 'boolean'
  );
}

export async function getRegionalData(
  signal?: AbortSignal,
): Promise<RegionalResponse> {
  const response = await fetch('/api/regional', {
    signal: withDeadline(signal, 25_000),
  });
  const data = await readBoundedResponseJson(response, 2 * 1024 * 1024).catch(
    () => null,
  );

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Failed to load regional and business data.';
    throw new Error(message);
  }

  if (!isRegionalResponse(data)) {
    throw new Error('The regional data service returned malformed data.');
  }
  return data;
}
