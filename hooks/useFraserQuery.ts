'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getThemes,
  getTheme,
  getThemeRecords,
  getTimelines,
  getTimeline,
  getTimelineEvents,
  getTitle,
  getTitleItems,
} from '@/lib/fraser';

// ─── Themes ────────────────────────────────────────────────────────────────────

export function useThemes(limit = 100) {
  return useQuery({
    queryKey: ['fraser', 'themes', limit],
    queryFn: ({ signal }) => getThemes(limit, 1, signal),
    staleTime: 30 * 60 * 1000, // 30 min — archival content changes rarely
  });
}

export function useFraserTheme(themeId: string | number) {
  return useQuery({
    queryKey: ['fraser', 'theme', themeId],
    queryFn: ({ signal }) => getTheme(themeId, signal),
    staleTime: 30 * 60 * 1000,
  });
}

export function useThemeRecords(themeId: string | number, limit = 20, page = 1) {
  return useQuery({
    queryKey: ['fraser', 'theme', themeId, 'records', page, limit],
    queryFn: ({ signal }) => getThemeRecords(themeId, limit, page, signal),
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Timelines ─────────────────────────────────────────────────────────────────

export function useTimelines() {
  return useQuery({
    queryKey: ['fraser', 'timelines'],
    queryFn: ({ signal }) => getTimelines(100, 1, signal),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useFraserTimeline(timelineId: string) {
  return useQuery({
    queryKey: ['fraser', 'timeline', timelineId],
    queryFn: ({ signal }) => getTimeline(timelineId, signal),
    staleTime: 60 * 60 * 1000,
  });
}

export function useTimelineEvents(timelineId: string) {
  return useQuery({
    queryKey: ['fraser', 'timeline', timelineId, 'events'],
    queryFn: ({ signal }) => getTimelineEvents(timelineId, 200, 1, signal),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Titles & Items ────────────────────────────────────────────────────────────

export function useFraserTitle(titleId: string | number) {
  return useQuery({
    queryKey: ['fraser', 'title', titleId],
    queryFn: ({ signal }) => getTitle(titleId, signal),
    staleTime: 30 * 60 * 1000,
  });
}

export function useTitleItems(titleId: string | number, limit = 20, page = 1) {
  return useQuery({
    queryKey: ['fraser', 'title', titleId, 'items', page, limit],
    queryFn: ({ signal }) => getTitleItems(titleId, limit, page, signal),
    staleTime: 30 * 60 * 1000,
  });
}
