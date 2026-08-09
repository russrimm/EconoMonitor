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

export type CensusFrequency = 'monthly' | 'quarterly';

export interface CensusIndicator {
  id: string;
  label: string;
  unit: string;
  note: string;
  group: string;
  frequency: CensusFrequency;
  /** `changeOnMonth` holds the quarter-on-quarter change for quarterly series. */
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
 *
 * Codes are taken from each program's published data dictionary
 * (`https://www.census.gov/econ_getzippedfile/?programCode=<PROGRAM>`). The API
 * answers an unknown pair with an empty result set rather than an error, so a
 * typo here fails silently — the pairs are pinned in tests.
 *
 * `seasonallyAdj` is per-dataset because adjustment is not universal: `vip` and
 * `hv` publish adjusted figures under separate category or data-type codes, and
 * `qfr`, `qpr` and `mhs2` publish none at all for these series.
 */
export const CENSUS_INDICATORS: readonly {
  id: string;
  dataset: string;
  categoryCode: string;
  dataTypeCode: string;
  seasonallyAdj: 'yes' | 'no';
  frequency: CensusFrequency;
  group: string;
  label: string;
  unit: string;
  note: string;
  /** Discontinued series, excluded from the partial-response calculation. */
  optional?: boolean;
  /**
   * `qtax` publishes its variables in upper case while every other EITS
   * dataset uses lower case. Requesting the wrong case returns an error, so the
   * exception is recorded rather than guessed at request time.
   */
  uppercaseVariables?: boolean;
}[] = [
  {
    id: 'retail-sales',
    dataset: 'marts',
    categoryCode: '44X72',
    dataTypeCode: 'SM',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Advance retail and food services sales',
    unit: '$M',
    note: 'Seasonally adjusted, published about two weeks after month end.',
  },
  {
    id: 'retail-sales-final',
    dataset: 'mrts',
    categoryCode: '44X72',
    dataTypeCode: 'SM',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Retail and food services sales (final)',
    unit: '$M',
    note: 'Revised estimate published a month after the advance reading.',
  },
  {
    id: 'retail-inventories',
    dataset: 'mrtsadv',
    categoryCode: '44000',
    dataTypeCode: 'IM',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Advance retail inventories',
    unit: '$M',
    note: 'End-of-month retail inventories, seasonally adjusted.',
  },
  {
    id: 'wholesale-sales',
    dataset: 'mwts',
    categoryCode: '42',
    dataTypeCode: 'SM',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Merchant wholesale sales',
    unit: '$M',
    note: 'Seasonally adjusted sales of merchant wholesalers.',
  },
  {
    id: 'wholesale-inventories',
    dataset: 'mwtsadv',
    categoryCode: '42',
    dataTypeCode: 'IM',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Advance wholesale inventories',
    unit: '$M',
    note: 'End-of-month wholesale inventories, seasonally adjusted.',
  },
  {
    id: 'inventories-to-sales',
    dataset: 'mtis',
    categoryCode: 'TOTBUS',
    dataTypeCode: 'IR',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Retail and wholesale trade',
    label: 'Total business inventories-to-sales ratio',
    unit: 'ratio',
    note: 'Months of inventory on hand across manufacturing, wholesale and retail.',
  },
  {
    id: 'durable-goods-orders',
    dataset: 'advm3',
    categoryCode: 'MDM',
    dataTypeCode: 'NO',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Manufacturing and business formation',
    label: 'Advance durable goods new orders',
    unit: '$M',
    note: 'Seasonally adjusted new orders for manufactured durable goods.',
  },
  {
    id: 'factory-orders',
    dataset: 'm3',
    categoryCode: 'MTM',
    dataTypeCode: 'NO',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Manufacturing and business formation',
    label: 'Manufacturers new orders (all industries)',
    unit: '$M',
    note: 'Full factory orders report, one month behind the durable goods advance.',
  },
  {
    id: 'business-applications',
    dataset: 'bfs',
    categoryCode: 'TOTAL',
    dataTypeCode: 'BA_BA',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Manufacturing and business formation',
    label: 'Business applications',
    unit: 'applications',
    note: 'Employer identification number applications, a leading signal of new firms.',
  },
  {
    id: 'corporate-sales',
    dataset: 'qfr',
    categoryCode: 'MFG',
    dataTypeCode: '101',
    seasonallyAdj: 'no',
    frequency: 'quarterly',
    group: 'Manufacturing and business formation',
    label: 'Manufacturing corporate net sales',
    unit: '$M',
    note: 'Quarterly Financial Report, not seasonally adjusted.',
  },
  {
    id: 'services-revenue',
    dataset: 'qss',
    categoryCode: '000000A',
    dataTypeCode: 'QREV',
    seasonallyAdj: 'yes',
    frequency: 'quarterly',
    group: 'Manufacturing and business formation',
    label: 'Selected services revenue',
    unit: '$M',
    note: 'Quarterly Services Survey, seasonally adjusted.',
  },
  {
    id: 'housing-starts',
    dataset: 'resconst',
    categoryCode: 'ASTARTS',
    dataTypeCode: 'TOTAL',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'Housing starts',
    unit: 'thousands of units',
    note: 'Seasonally adjusted annual rate of new privately owned housing units started.',
  },
  {
    id: 'building-permits',
    dataset: 'resconst',
    categoryCode: 'APERMITS',
    dataTypeCode: 'TOTAL',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'Building permits',
    unit: 'thousands of units',
    note: 'Seasonally adjusted annual rate; leads starts by roughly a month.',
  },
  {
    id: 'new-home-sales',
    dataset: 'ressales',
    categoryCode: 'ASOLD',
    dataTypeCode: 'TOTAL',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'New single-family home sales',
    unit: 'thousands of units',
    note: 'Seasonally adjusted annual rate.',
  },
  {
    id: 'construction-spending',
    dataset: 'vip',
    categoryCode: 'AXXXX',
    dataTypeCode: 'T',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'Total construction spending',
    unit: '$M',
    note: 'Seasonally adjusted annual rate of value put in place.',
  },
  {
    id: 'homeownership-rate',
    dataset: 'hv',
    categoryCode: 'RATE',
    dataTypeCode: 'SAHOR',
    seasonallyAdj: 'yes',
    frequency: 'quarterly',
    group: 'Housing and construction',
    label: 'Homeownership rate',
    unit: '%',
    note: 'Share of occupied housing units owned by the occupant, seasonally adjusted.',
  },
  {
    id: 'manufactured-home-shipments',
    dataset: 'mhs2',
    categoryCode: 'T',
    dataTypeCode: 'SH',
    seasonallyAdj: 'no',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'Manufactured home shipments',
    unit: 'thousands of units',
    note: 'Not seasonally adjusted; the adjusted rows carry percentage shares, not counts.',
  },
  {
    id: 'manufactured-home-shipments-legacy',
    dataset: 'mhs',
    categoryCode: 'T',
    dataTypeCode: 'SH',
    seasonallyAdj: 'no',
    frequency: 'monthly',
    group: 'Housing and construction',
    label: 'Manufactured home shipments (pre-2014 series)',
    unit: 'thousands of units',
    note: 'Discontinued survey retained for history; superseded by the 2014 redesign.',
    optional: true,
  },
  {
    id: 'trade-balance',
    dataset: 'ftd',
    categoryCode: 'BOPGS',
    dataTypeCode: 'BAL',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'International trade',
    label: 'Goods and services trade balance',
    unit: '$M',
    note: 'Balance of payments basis, seasonally adjusted. Negative values are deficits.',
  },
  {
    id: 'trade-balance-advance',
    dataset: 'ftdadv',
    categoryCode: 'CBG',
    dataTypeCode: 'BAL',
    seasonallyAdj: 'yes',
    frequency: 'monthly',
    group: 'International trade',
    label: 'Advance goods trade balance',
    unit: '$M',
    note: 'Census basis goods only, released about a week before the full report.',
  },
  {
    id: 'state-local-tax-revenue',
    dataset: 'qtax',
    categoryCode: 'QTAXCAT1',
    dataTypeCode: 'TOTAL',
    seasonallyAdj: 'yes',
    frequency: 'quarterly',
    group: 'Government finance',
    label: 'State and local tax revenue',
    unit: '$M',
    note: 'National totals of state and local tax collections, seasonally adjusted.',
    uppercaseVariables: true,
  },
  {
    id: 'public-pension-holdings',
    dataset: 'qpr',
    categoryCode: 'TOTHOLDINGS',
    dataTypeCode: 'HLDTOT',
    seasonallyAdj: 'no',
    frequency: 'quarterly',
    group: 'Government finance',
    label: 'Public pension total holdings',
    unit: '$M',
    note: 'Cash and security holdings of the largest state and local pension systems.',
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
 * Aggregates BEA returns alongside the states themselves: `00000` is the
 * national total and `91000`-`98000` are the eight BEA regions. Including them
 * would rank "Far West" against California, so the table keeps states and DC
 * only.
 */
export function isBeaStateFips(fips: string): boolean {
  return /^\d{2}000$/.test(fips) && fips !== '00000' && !/^9/.test(fips);
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
    if (!isBeaStateFips(row.GeoFips)) continue;

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

/**
 * Census EITS returns `YYYY-MM` for monthly datasets and `YYYY-Q<n>` for the
 * quarterly ones (`hv`, `qfr`, `qss`, `qtax`, `qpr`), per each dataset's
 * `time` variable metadata. Both are normalised to the first day of the period
 * so a single date-keyed lookup works for either frequency.
 */
export function parseCensusPeriod(value: string): string | null {
  const trimmed = value.trim();

  const monthly = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    const month = Number(monthly[2]);
    if (month < 1 || month > 12) return null;
    return `${monthly[1]}-${monthly[2]}-01`;
  }

  const quarterly = trimmed.match(/^(\d{4})-Q(\d{1,2})$/i);
  if (quarterly) {
    const quarter = Number(quarterly[2]);
    if (quarter < 1 || quarter > 4) return null;
    const month = String(quarter * 3 - 2).padStart(2, '0');
    return `${quarterly[1]}-${month}-01`;
  }

  return null;
}

/**
 * Census returns a header row followed by data rows, both as string arrays.
 * Column order is not guaranteed, so values are looked up by header name.
 *
 * Header names are matched case-insensitively because `qtax` echoes upper-case
 * variable names (`CELL_VALUE`) while every other EITS dataset uses lower case.
 *
 * `resconst` and `ressales` report each period five times — once nationally and
 * once per census region — so rows are narrowed to `geo_level_code` `US`.
 * Without that filter a region's value silently stands in for the national one.
 * The column is absent on single-geography datasets, which are kept as-is.
 */
export function parseCensusTimeseries(payload: unknown): CensusObservation[] {
  if (!Array.isArray(payload) || payload.length < 2) {
    throw new Error('upstream response was not a Census timeseries table');
  }

  const [header, ...rows] = payload;
  if (!Array.isArray(header)) {
    throw new Error('Census response header was malformed');
  }
  const columnOf = (name: string): number =>
    header.findIndex(
      (column) =>
        typeof column === 'string' &&
        column.toLowerCase() === name.toLowerCase(),
    );

  const valueIndex = columnOf('cell_value');
  const timeIndex = columnOf('time');
  if (valueIndex === -1 || timeIndex === -1) {
    throw new Error('Census response was missing cell_value or time');
  }
  const geoIndex = columnOf('geo_level_code');

  const observations: CensusObservation[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    if (geoIndex !== -1 && row[geoIndex] !== 'US') continue;

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

  // Quarterly series are stamped on the first month of the quarter, so the
  // prior period is three months back rather than one.
  const priorStep = definition.frequency === 'quarterly' ? 3 : 1;

  return {
    id: definition.id,
    label: definition.label,
    unit: definition.unit,
    note: definition.note,
    group: definition.group,
    frequency: definition.frequency,
    latest,
    changeOnMonth: percentChange(latest.value, shift(priorStep)),
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
        typeof indicator.group === 'string' &&
        (indicator.frequency === 'monthly' ||
          indicator.frequency === 'quarterly') &&
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
