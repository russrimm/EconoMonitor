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

// ─── Internal fetch helper ──────────────────────────────────────────────────────
// Calls the Next.js API proxy (which appends the FRED API key server-side).
// Only runs in the browser context inside 'use client' components/hooks.

async function fredFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const url = `/api/fred/${path}?${searchParams.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `FRED proxy error ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// ─── Observation date range helpers ────────────────────────────────────────────

function rangeToStartDate(range: ObservationRange): string | undefined {
  if (range === 'max') return undefined;
  const d = new Date();
  if (range === '1y')  d.setFullYear(d.getFullYear() - 1);
  if (range === '5y')  d.setFullYear(d.getFullYear() - 5);
  if (range === '10y') d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().split('T')[0];
}

// ─── Series ────────────────────────────────────────────────────────────────────

export async function searchSeries(query: string, offset = 0, limit = 20) {
  return fredFetch<{
    seriess: FredSeries[];
    count: number;
    offset: number;
    limit: number;
  }>('series/search', {
    search_text: query,
    offset: String(offset),
    limit: String(limit),
    order_by: 'popularity',
    sort_order: 'desc',
  });
}

export async function getSeries(seriesId: string) {
  return fredFetch<{ seriess: FredSeries[] }>('series', { series_id: seriesId });
}

export async function getObservations(
  seriesId: string,
  range: ObservationRange = 'max',
) {
  const params: Record<string, string> = {
    series_id: seriesId,
    sort_order: 'asc',
    limit: '100000',
  };
  const start = rangeToStartDate(range);
  if (start) params.observation_start = start;
  return fredFetch<{ observations: FredObservation[]; count: number }>(
    'series/observations',
    params,
  );
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getCategory(categoryId: number) {
  return fredFetch<{ categories: FredCategory[] }>('category', {
    category_id: String(categoryId),
  });
}

export async function getCategoryChildren(categoryId: number) {
  return fredFetch<{ categories: FredCategory[] }>('category/children', {
    category_id: String(categoryId),
  });
}

export async function getCategorySeries(categoryId: number, offset = 0) {
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
  });
}

// ─── Releases ──────────────────────────────────────────────────────────────────

export async function getReleases(offset = 0) {
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
  });
}

export async function getReleaseDates(limit = 100) {
  return fredFetch<{ release_dates: FredReleaseDate[] }>('releases/dates', {
    limit: String(limit),
    include_release_dates_with_no_data: 'false',
    sort_order: 'desc',
  });
}
