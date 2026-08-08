import {
  readBoundedResponseJson,
  withDeadline,
} from './responseBody.ts';

/**
 * Every EIA series the app requests, grouped by the v2 route that serves it.
 * Nothing here is caller-controlled — the route builds its upstream URLs from
 * this table alone.
 */
export const ENERGY_ROUTES: readonly {
  route: string;
  frequency: 'daily' | 'weekly';
  operation: string;
  series: readonly {
    id: string;
    label: string;
    unit: string;
    category: 'Fuel prices' | 'Crude oil' | 'Natural gas';
  }[];
}[] = [
  {
    route: 'petroleum/pri/gnd',
    frequency: 'weekly',
    operation: 'retail-fuel-prices',
    series: [
      {
        id: 'EMM_EPMR_PTE_NUS_DPG',
        label: 'Regular gasoline, US average',
        unit: '$/gal',
        category: 'Fuel prices',
      },
      {
        id: 'EMD_EPD2D_PTE_NUS_DPG',
        label: 'Diesel, US average',
        unit: '$/gal',
        category: 'Fuel prices',
      },
    ],
  },
  {
    route: 'petroleum/pri/spt',
    frequency: 'daily',
    operation: 'crude-spot-prices',
    series: [
      {
        id: 'RWTC',
        label: 'WTI crude oil spot',
        unit: '$/barrel',
        category: 'Crude oil',
      },
      {
        id: 'RBRTE',
        label: 'Brent crude oil spot',
        unit: '$/barrel',
        category: 'Crude oil',
      },
    ],
  },
  {
    route: 'natural-gas/pri/fut',
    frequency: 'daily',
    operation: 'natural-gas-prices',
    series: [
      {
        id: 'RNGWHHD',
        label: 'Henry Hub natural gas spot',
        unit: '$/MMBtu',
        category: 'Natural gas',
      },
    ],
  },
];

export interface EnergyObservation {
  date: string;
  value: number;
}

export interface EnergySeries {
  id: string;
  label: string;
  unit: string;
  category: string;
  latest: EnergyObservation;
  changeOnWeek: number | null;
  changeOnYear: number | null;
  observations: EnergyObservation[];
}

export interface EnergyResponse {
  series: EnergySeries[];
  updatedAt: string;
  partial: boolean;
  configured: boolean;
}

interface EiaRow {
  period?: unknown;
  series?: unknown;
  value?: unknown;
}

/** EIA periods are plain calendar days (`YYYY-MM-DD`) for these routes. */
export function parseEiaPeriod(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value.trim();
}

function parseEiaValue(value: unknown): number | null {
  // EIA returns numbers for most rows but strings on some routes, and null for
  // periods where the price was not published.
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Groups a flat EIA `response.data` array into one ascending observation list
 * per series ID.
 */
export function groupEiaRows(payload: unknown): Map<string, EnergyObservation[]> {
  const rows = (payload as { response?: { data?: unknown } } | null)?.response
    ?.data;
  if (!Array.isArray(rows)) {
    throw new Error('upstream response did not contain data rows');
  }

  const grouped = new Map<string, EnergyObservation[]>();
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as EiaRow;
    if (typeof row.series !== 'string') continue;

    const date = parseEiaPeriod(row.period);
    const value = parseEiaValue(row.value);
    if (!date || value === null) continue;

    const observations = grouped.get(row.series) ?? [];
    observations.push({ date, value });
    grouped.set(row.series, observations);
  }

  for (const observations of grouped.values()) {
    observations.sort((left, right) => left.date.localeCompare(right.date));
  }
  return grouped;
}

/**
 * Returns the observation closest to `daysBack` before the latest one, looking
 * only at earlier dates so a sparse series never compares against itself.
 */
export function findComparison(
  observations: EnergyObservation[],
  daysBack: number,
): EnergyObservation | null {
  const latest = observations.at(-1);
  if (!latest || observations.length < 2) return null;

  const targetTime =
    new Date(`${latest.date}T00:00:00Z`).getTime() - daysBack * 86_400_000;
  // A quarter of the window is the widest gap still worth labelling as a
  // week-ago or year-ago comparison.
  const tolerance = Math.max(daysBack * 0.25, 3) * 86_400_000;

  let best: EnergyObservation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const observation of observations.slice(0, -1)) {
    const distance = Math.abs(
      new Date(`${observation.date}T00:00:00Z`).getTime() - targetTime,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = observation;
    }
  }
  return best && bestDistance <= tolerance ? best : null;
}

export function percentChange(
  latest: EnergyObservation,
  previous: EnergyObservation | null,
): number | null {
  if (!previous || previous.value === 0) return null;
  return ((latest.value - previous.value) / previous.value) * 100;
}

export function isEnergyResponse(value: unknown): value is EnergyResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<EnergyResponse>;
  return (
    Array.isArray(candidate.series) &&
    candidate.series.every(
      (series) =>
        typeof series === 'object' &&
        series !== null &&
        typeof series.id === 'string' &&
        typeof series.label === 'string' &&
        typeof series.unit === 'string' &&
        typeof series.category === 'string' &&
        typeof series.latest === 'object' &&
        series.latest !== null &&
        typeof series.latest.date === 'string' &&
        typeof series.latest.value === 'number' &&
        Array.isArray(series.observations),
    ) &&
    typeof candidate.updatedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    typeof candidate.partial === 'boolean' &&
    typeof candidate.configured === 'boolean'
  );
}

export async function getEnergyPrices(
  signal?: AbortSignal,
): Promise<EnergyResponse> {
  const response = await fetch('/api/energy', {
    signal: withDeadline(signal, 20_000),
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
        : 'Failed to load energy price data.';
    throw new Error(message);
  }

  if (!isEnergyResponse(data)) {
    throw new Error('The energy price service returned malformed data.');
  }
  return data;
}
