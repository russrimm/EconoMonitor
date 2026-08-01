'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import {
  searchSeries,
  getSeries,
  getObservations,
  getCategory,
  getCategoryChildren,
  getCategorySeries,
  getReleases,
  getReleaseDates,
  type ObservationOptions,
  type ObservationRange,
} from '@/lib/fred';

/** Stable, primitive query-key fragment for an options bag. */
function optionsKey(options: ObservationOptions) {
  return [
    options.units ?? 'lin',
    options.frequency ?? '',
    options.frequency ? options.aggregation ?? 'avg' : '',
    options.maxObservations ?? '',
  ] as const;
}

// ─── Series ────────────────────────────────────────────────────────────────────

export function useSeriesSearch(
  query: string,
  offset = 0,
  orderBy: 'popularity' | 'last_updated' | 'title' = 'popularity',
) {
  return useQuery({
    queryKey: ['series-search', query, offset, orderBy],
    queryFn: ({ signal }) => searchSeries(query, offset, 20, orderBy, signal),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSeries(seriesId: string) {
  return useQuery({
    queryKey: ['series', seriesId],
    queryFn: ({ signal }) => getSeries(seriesId, signal),
    enabled: !!seriesId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useObservations(
  seriesId: string,
  range: ObservationRange = 'max',
  options: ObservationOptions = {},
) {
  return useQuery({
    queryKey: ['observations', seriesId, range, ...optionsKey(options)],
    queryFn: ({ signal }) => getObservations(seriesId, range, options, signal),
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch multiple series' observations in parallel */
export function useMultiObservations(
  seriesIds: string[],
  range: ObservationRange,
  options: ObservationOptions = {},
) {
  const key = optionsKey(options);
  return useQueries({
    queries: seriesIds.map((id) => ({
      queryKey: ['observations', id, range, ...key],
      queryFn: ({ signal }) => getObservations(id, range, options, signal),
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    })),
  });
}

/** Fetch multiple series metadata in parallel */
export function useMultiSeries(seriesIds: string[]) {
  return useQueries({
    queries: seriesIds.map((id) => ({
      queryKey: ['series', id],
      queryFn: ({ signal }) => getSeries(id, signal),
      enabled: !!id,
      staleTime: 10 * 60 * 1000,
    })),
  });
}

// ─── Categories ────────────────────────────────────────────────────────────────

export function useCategory(categoryId: number) {
  return useQuery({
    queryKey: ['category', categoryId],
    queryFn: ({ signal }) => getCategory(categoryId, signal),
    enabled: Number.isInteger(categoryId) && categoryId >= 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCategoryChildren(categoryId: number) {
  return useQuery({
    queryKey: ['category-children', categoryId],
    queryFn: ({ signal }) => getCategoryChildren(categoryId, signal),
    enabled: Number.isInteger(categoryId) && categoryId >= 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCategorySeries(categoryId: number, offset = 0) {
  return useQuery({
    queryKey: ['category-series', categoryId, offset],
    queryFn: ({ signal }) => getCategorySeries(categoryId, offset, signal),
    enabled: Number.isInteger(categoryId) && categoryId >= 0,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Releases ──────────────────────────────────────────────────────────────────

export function useReleases(offset = 0) {
  return useQuery({
    queryKey: ['releases', offset],
    queryFn: ({ signal }) => getReleases(offset, signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReleaseDates() {
  return useQuery({
    queryKey: ['release-dates'],
    queryFn: ({ signal }) => getReleaseDates(signal),
    staleTime: 5 * 60 * 1000,
  });
}
