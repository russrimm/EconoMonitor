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
    queryFn: () => getThemes(limit),
    staleTime: 30 * 60 * 1000, // 30 min — archival content changes rarely
  });
}

export function useFraserTheme(themeId: string | number) {
  return useQuery({
    queryKey: ['fraser', 'theme', themeId],
    queryFn: () => getTheme(themeId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useThemeRecords(themeId: string | number, limit = 20, page = 1) {
  return useQuery({
    queryKey: ['fraser', 'theme', themeId, 'records', page, limit],
    queryFn: () => getThemeRecords(themeId, limit, page),
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Timelines ─────────────────────────────────────────────────────────────────

export function useTimelines() {
  return useQuery({
    queryKey: ['fraser', 'timelines'],
    queryFn: () => getTimelines(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useFraserTimeline(timelineId: string) {
  return useQuery({
    queryKey: ['fraser', 'timeline', timelineId],
    queryFn: () => getTimeline(timelineId),
    staleTime: 60 * 60 * 1000,
  });
}

export function useTimelineEvents(timelineId: string) {
  return useQuery({
    queryKey: ['fraser', 'timeline', timelineId, 'events'],
    queryFn: () => getTimelineEvents(timelineId),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Titles & Items ────────────────────────────────────────────────────────────

export function useFraserTitle(titleId: string | number) {
  return useQuery({
    queryKey: ['fraser', 'title', titleId],
    queryFn: () => getTitle(titleId),
    staleTime: 30 * 60 * 1000,
  });
}

export function useTitleItems(titleId: string | number, limit = 20, page = 1) {
  return useQuery({
    queryKey: ['fraser', 'title', titleId, 'items', page, limit],
    queryFn: () => getTitleItems(titleId, limit, page),
    staleTime: 30 * 60 * 1000,
  });
}
