// ─── FRED API Types ────────────────────────────────────────────────────────────

export interface FredSeries {
  id: string;
  realtime_start: string;
  realtime_end: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  last_updated: string;
  popularity: number;
  notes?: string;
}

export interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string; // "." means missing / not available
}

export interface FredCategory {
  id: number;
  name: string;
  parent_id: number;
}

export interface FredRelease {
  id: number;
  realtime_start: string;
  realtime_end: string;
  name: string;
  press_release: boolean;
  link?: string;
}

export interface FredReleaseDate {
  release_id: number;
  release_name: string;
  date: string;
}

export type ObservationRange = '1y' | '5y' | '10y' | 'max';

export const OBSERVATION_RANGES: readonly ObservationRange[] = [
  '1y',
  '5y',
  '10y',
  'max',
];

export function parseObservationRange(
  value: string | null | undefined,
  fallback: ObservationRange = '5y',
): ObservationRange {
  return OBSERVATION_RANGES.includes(value as ObservationRange)
    ? (value as ObservationRange)
    : fallback;
}

// ─── Transformations ───────────────────────────────────────────────────────────
// FRED applies these server-side via the `units`, `frequency` and
// `aggregation_method` parameters on /series/observations.
// See https://fred.stlouisfed.org/docs/api/fred/series_observations.html

export type FredUnits =
  | 'lin'  // levels, no transformation
  | 'chg'  // change from previous period
  | 'ch1'  // change from a year ago
  | 'pch'  // percent change from previous period
  | 'pc1'  // percent change from a year ago
  | 'pca'  // compounded annual rate of change
  | 'cch'  // continuously compounded rate of change
  | 'cca'  // continuously compounded annual rate of change
  | 'log'; // natural log

export interface TransformOption {
  value: FredUnits;
  /** Short label for the picker. */
  label: string;
  /** One-line explanation shown as a tooltip. */
  description: string;
  /**
   * Axis / tooltip units when this transform is active. `null` means the
   * series' own units are preserved (levels and absolute changes).
   */
  unitsLabel: string | null;
}

export const TRANSFORMS: TransformOption[] = [
  {
    value: 'lin',
    label: 'Levels',
    description: 'The series as published, with no transformation applied.',
    unitsLabel: null,
  },
  {
    value: 'pch',
    label: '% change',
    description: 'Percent change from the previous period (e.g. month over month).',
    unitsLabel: '% change',
  },
  {
    value: 'pc1',
    label: '% change from year ago',
    description: 'Percent change from the same period one year earlier — the standard year-over-year rate.',
    unitsLabel: '% change from year ago',
  },
  {
    value: 'pca',
    label: '% change, annual rate',
    description: 'Period-over-period percent change compounded to an annual rate.',
    unitsLabel: '% change at annual rate',
  },
  {
    value: 'chg',
    label: 'Change',
    description: 'Absolute change from the previous period, in the series\u2019 own units.',
    unitsLabel: null,
  },
  {
    value: 'ch1',
    label: 'Change from year ago',
    description: 'Absolute change from the same period one year earlier, in the series\u2019 own units.',
    unitsLabel: null,
  },
  {
    value: 'cch',
    label: 'Cont. compounded % change',
    description: 'Continuously compounded rate of change from the previous period.',
    unitsLabel: '% change (cont. comp.)',
  },
  {
    value: 'cca',
    label: 'Cont. compounded annual rate',
    description: 'Continuously compounded rate of change expressed at an annual rate.',
    unitsLabel: '% change at annual rate (cont. comp.)',
  },
  {
    value: 'log',
    label: 'Natural log',
    description: 'Natural logarithm of the level — turns exponential growth into a straight line.',
    unitsLabel: 'log',
  },
];

export const TRANSFORM_MAP: Record<FredUnits, TransformOption> = Object.fromEntries(
  TRANSFORMS.map((t) => [t.value, t]),
) as Record<FredUnits, TransformOption>;

/** Axis / tooltip units for a series once a transform is applied. */
export function transformedUnits(seriesUnits: string, units: FredUnits): string {
  const t = TRANSFORM_MAP[units];
  if (
    (units === 'chg' || units === 'ch1') &&
    (seriesUnits.includes('%') || /percent/i.test(seriesUnits))
  ) {
    return 'Percentage points';
  }
  if (!t || t.unitsLabel === null) return seriesUnits;
  if (units === 'log') return seriesUnits ? `log(${seriesUnits})` : 'log';
  return t.unitsLabel;
}

/** Short suffix appended to a series title when a transform is active. */
export function transformSuffix(units: FredUnits): string {
  return units === 'lin' ? '' : ` — ${TRANSFORM_MAP[units].label}`;
}

// ─── Frequency aggregation ─────────────────────────────────────────────────────

/** Empty string means "use the series' native frequency". */
export type FredFrequency = '' | 'd' | 'w' | 'bw' | 'm' | 'q' | 'sa' | 'a';
export type FredAggregation = 'avg' | 'sum' | 'eop';

export const FREQUENCIES: { value: Exclude<FredFrequency, ''>; label: string }[] = [
  { value: 'd',  label: 'Daily' },
  { value: 'w',  label: 'Weekly' },
  { value: 'bw', label: 'Biweekly' },
  { value: 'm',  label: 'Monthly' },
  { value: 'q',  label: 'Quarterly' },
  { value: 'sa', label: 'Semiannual' },
  { value: 'a',  label: 'Annual' },
];

export const AGGREGATIONS: { value: FredAggregation; label: string; description: string }[] = [
  { value: 'avg', label: 'Average',    description: 'Average of the observations in each aggregated period.' },
  { value: 'sum', label: 'Sum',        description: 'Sum of the observations in each aggregated period.' },
  { value: 'eop', label: 'End of period', description: 'The last observation in each aggregated period.' },
];

/** Ordering from highest to lowest frequency. FRED can only aggregate downward. */
const FREQUENCY_RANK: Record<Exclude<FredFrequency, ''>, number> = {
  d: 0, w: 1, bw: 2, m: 3, q: 4, sa: 5, a: 6,
};

/**
 * Map a series' `frequency_short` (e.g. "M", "Q", "D") onto our frequency codes.
 * Returns `null` for frequencies FRED can't aggregate from (e.g. "Not Applicable").
 */
export function nativeFrequencyCode(
  frequencyShort: string,
): Exclude<FredFrequency, ''> | null {
  const key = frequencyShort.trim().toLowerCase();
  return key in FREQUENCY_RANK ? (key as Exclude<FredFrequency, ''>) : null;
}

/**
 * Frequencies a series can legally be aggregated to — strictly lower frequency
 * than its native one. Returns an empty list when aggregation isn't possible.
 */
export function aggregatableFrequencies(
  frequencyShort: string,
): { value: Exclude<FredFrequency, ''>; label: string }[] {
  const native = nativeFrequencyCode(frequencyShort);
  if (!native) return [];
  const nativeRank = FREQUENCY_RANK[native];
  return FREQUENCIES.filter((f) => FREQUENCY_RANK[f.value] > nativeRank);
}

export interface ObservationOptions {
  units?: FredUnits;
  frequency?: FredFrequency;
  aggregation?: FredAggregation;
  /** Return only the most recent N observations, in chronological order. */
  maxObservations?: number;
}

// ─── Internal fetch helper ──────────────────────────────────────────────────────
// Calls the Next.js API proxy (which appends the FRED API key server-side).
// Only runs in the browser context inside 'use client' components/hooks.

async function fredFetch<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const url = `/api/fred/${path}?${searchParams.toString()}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `FRED proxy error ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// ─── Observation date range helpers ────────────────────────────────────────────

export function observationStartDate(
  range: ObservationRange,
  now = new Date(),
): string | undefined {
  if (range === 'max') return undefined;
  const years = range === '1y' ? 1 : range === '5y' ? 5 : 10;
  const targetYear = now.getUTCFullYear() - years;
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDay);
  return [
    String(targetYear).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

/**
 * Differencing transforms consume leading observations: a year-over-year rate
 * needs a full year of prior history, and even a single-period change needs one
 * earlier point (which for an annual series is itself a year back). We therefore
 * request extra history and trim it off client-side, so the requested window is
 * fully populated regardless of how FRED bounds the calculation.
 */
function needsLookback(units: FredUnits): boolean {
  return units !== 'lin' && units !== 'log';
}

function padStartDate(start: string): string {
  const d = new Date(start + 'T00:00:00');
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() - 35);
  return d.toISOString().split('T')[0];
}

// ─── Series ────────────────────────────────────────────────────────────────────

export async function searchSeries(
  query: string,
  offset = 0,
  limit = 20,
  orderBy: 'popularity' | 'last_updated' | 'title' = 'popularity',
  signal?: AbortSignal,
) {
  return fredFetch<{
    seriess: FredSeries[];
    count: number;
    offset: number;
    limit: number;
  }>('series/search', {
    search_text: query,
    offset: String(offset),
    limit: String(limit),
    order_by: orderBy,
    sort_order: orderBy === 'title' ? 'asc' : 'desc',
  }, signal);
}

export async function getSeries(seriesId: string, signal?: AbortSignal) {
  return fredFetch<{ seriess: FredSeries[] }>(
    'series',
    { series_id: seriesId },
    signal,
  );
}

export async function getObservations(
  seriesId: string,
  range: ObservationRange = 'max',
  options: ObservationOptions = {},
  signal?: AbortSignal,
) {
  const units = options.units ?? 'lin';
  const maxObservations =
    Number.isInteger(options.maxObservations) &&
    options.maxObservations! > 0 &&
    options.maxObservations! <= 100_000
      ? options.maxObservations
      : undefined;
  const params: Record<string, string> = {
    series_id: seriesId,
    sort_order: maxObservations ? 'desc' : 'asc',
    limit: String(maxObservations ?? 100_000),
    units,
  };

  if (options.frequency) {
    params.frequency = options.frequency;
    params.aggregation_method = options.aggregation ?? 'avg';
  }

  const start = observationStartDate(range);
  if (start) {
    params.observation_start = needsLookback(units) ? padStartDate(start) : start;
  }

  const data = await fredFetch<{ observations: FredObservation[]; count: number }>(
    'series/observations',
    params,
    signal,
  );

  let observations = maxObservations
    ? [...data.observations].reverse()
    : data.observations;

  // Trim the padding back off so callers get exactly the window they asked for.
  if (start && params.observation_start !== start) {
    observations = observations.filter((o) => o.date >= start);
    return { ...data, observations, count: observations.length };
  }
  return maxObservations
    ? { ...data, observations, count: observations.length }
    : data;
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getCategory(categoryId: number, signal?: AbortSignal) {
  return fredFetch<{ categories: FredCategory[] }>('category', {
    category_id: String(categoryId),
  }, signal);
}

export async function getCategoryChildren(categoryId: number, signal?: AbortSignal) {
  return fredFetch<{ categories: FredCategory[] }>('category/children', {
    category_id: String(categoryId),
  }, signal);
}

export async function getCategorySeries(
  categoryId: number,
  offset = 0,
  signal?: AbortSignal,
) {
  return fredFetch<{
    seriess: FredSeries[];
    count: number;
    offset: number;
    limit: number;
  }>('category/series', {
    category_id: String(categoryId),
    offset: String(offset),
    limit: '20',
    order_by: 'popularity',
    sort_order: 'desc',
  }, signal);
}

// ─── Releases ──────────────────────────────────────────────────────────────────

export async function getReleases(offset = 0, signal?: AbortSignal) {
  return fredFetch<{
    releases: FredRelease[];
    count: number;
    offset: number;
    limit: number;
  }>('releases', {
    offset: String(offset),
    limit: '50',
    order_by: 'name',
    sort_order: 'asc',
  }, signal);
}

export async function getReleaseDates(limit = 100, signal?: AbortSignal) {
  return fredFetch<{ release_dates: FredReleaseDate[] }>('releases/dates', {
    limit: String(limit),
    include_release_dates_with_no_data: 'true',
    sort_order: 'desc',
  }, signal);
}
