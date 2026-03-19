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
  type ObservationRange,
} from '@/lib/fred';

// ─── Series ────────────────────────────────────────────────────────────────────

export function useSeriesSearch(query: string, offset = 0) {
  return useQuery({
    queryKey: ['series-search', query, offset],
    queryFn: () => searchSeries(query, offset),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSeries(seriesId: string) {
  return useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => getSeries(seriesId),
    enabled: !!seriesId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useObservations(seriesId: string, range: ObservationRange = 'max') {
  return useQuery({
    queryKey: ['observations', seriesId, range],
    queryFn: () => getObservations(seriesId, range),
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch multiple series' observations in parallel */
export function useMultiObservations(seriesIds: string[], range: ObservationRange) {
  return useQueries({
    queries: seriesIds.map((id) => ({
      queryKey: ['observations', id, range],
      queryFn: () => getObservations(id, range),
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
      queryFn: () => getSeries(id),
      enabled: !!id,
      staleTime: 10 * 60 * 1000,
    })),
  });
}

// ─── Categories ────────────────────────────────────────────────────────────────

export function useCategory(categoryId: number) {
  return useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => getCategory(categoryId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCategoryChildren(categoryId: number) {
  return useQuery({
    queryKey: ['category-children', categoryId],
    queryFn: () => getCategoryChildren(categoryId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCategorySeries(categoryId: number, offset = 0) {
  return useQuery({
    queryKey: ['category-series', categoryId, offset],
    queryFn: () => getCategorySeries(categoryId, offset),
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Releases ──────────────────────────────────────────────────────────────────

export function useReleases(offset = 0) {
  return useQuery({
    queryKey: ['releases', offset],
    queryFn: () => getReleases(offset),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReleaseDates() {
  return useQuery({
    queryKey: ['release-dates'],
    queryFn: () => getReleaseDates(100),
    staleTime: 5 * 60 * 1000,
  });
}
