import {
  readBoundedResponseJson,
  withDeadline,
} from './responseBody.ts';

// ─── FRASER API Types ──────────────────────────────────────────────────────────
// FRASER (Federal Reserve Archival System for Economic Research)
// API docs: https://fraser.stlouisfed.org/api-documentation/rest-api

export interface FraserResponse<T> {
  format: string;
  page: number;
  limit: number;
  total: number;
  start: number;
  records: T[];
}

export interface FraserTitleInfo {
  title: string;
  '@type'?: string;
  titlePartNumber?: string;
}

export interface FraserRecordInfo {
  recordIdentifier: (string | number)[];
  recordType: string;
  recordUpdatedDate?: string;
  recordCreationDate?: string;
  recordContentSource?: (string | { $: string; '@authorityURI'?: string })[];
}

export interface FraserLocation {
  url?: (string | { $: string; '@access'?: string })[];
  apiUrl?: string[];
  pdfUrl?: string[];
  textUrl?: string[];
}

export interface FraserOriginInfo {
  issuance?: string;
  frequency?: string;
  sortDate?: string;
  dateIssued?: (string | { $: string; '@point'?: string })[];
}

export interface FraserName {
  role: string;
  '@type'?: string;
  namePart: (string | { $: string; '@type': string })[];
  recordInfo?: { recordIdentifier: (string | number)[] };
  affiliation?: string;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export interface FraserTheme {
  titleInfo: FraserTitleInfo[];
  abstract?: string[];
  recordInfo: FraserRecordInfo;
  location: FraserLocation;
  subject?: {
    topic?: { topic: string; recordInfo: { recordIdentifier: (string | number)[] } }[];
  };
  relatedItem?: Array<{
    url?: string[];
    '@type'?: string;
    titleInfo?: FraserTitleInfo[];
  }>;
  accessCondition?: string;
}

// ─── Timelines ────────────────────────────────────────────────────────────────

export interface FraserTimeline {
  id: string;
  url: string;
  title: string;
  description?: string;
  abstract?: string;
  created?: string;
  modified?: string;
}

export interface FraserTimelineEvent {
  // Standard FRASER record fields
  titleInfo?: FraserTitleInfo[];
  originInfo?: FraserOriginInfo;
  abstract?: string[];
  note?: string[];
  location?: FraserLocation;
  relatedItem?: Array<{
    '@type'?: string;
    recordInfo?: FraserRecordInfo;
    titleInfo?: FraserTitleInfo[];
  }>;
  recordInfo?: FraserRecordInfo;
  // Flat properties that timeline events may also carry
  date?: string;
  title?: string;
  description?: string;
}

// ─── Generic record (titles, items, theme records) ───────────────────────────

export interface FraserRecord {
  titleInfo?: FraserTitleInfo[];
  originInfo?: FraserOriginInfo;
  abstract?: string[];
  genre?: string[];
  typeOfResource?: string;
  accessCondition?: string;
  recordInfo: FraserRecordInfo;
  location?: FraserLocation;
  name?: FraserName[];
  subject?: {
    topic?: { topic: string; recordInfo: { recordIdentifier: (string | number)[] } }[];
    geographic?: { geographic: string; recordInfo: { recordIdentifier: (string | number)[] } }[];
    theme?: { theme: string; recordInfo: { recordIdentifier: (string | number)[] } }[];
  };
  relatedItem?: Array<{
    '@type'?: string;
    recordInfo?: { recordIdentifier: (string | number)[] };
    titleInfo?: FraserTitleInfo[];
    name?: FraserName[];
  }>;
  physicalDescription?: {
    form?: string;
    extent?: string;
    digitalOrigin?: string;
    internetMediaType?: string[];
  };
}

// ─── Helper extractors ────────────────────────────────────────────────────────

export function extractTitle(titleInfo?: FraserTitleInfo[]): string {
  return titleInfo?.[0]?.title ?? 'Untitled';
}

export function extractId(recordInfo: FraserRecordInfo): string {
  return String(recordInfo.recordIdentifier?.[0] ?? '');
}

/** Extracts the first plain URL string from location.url (ignores @access preview entries). */
export function extractUrl(location?: FraserLocation): string {
  if (!location?.url?.length) return '#';
  const first = location.url[0];
  if (typeof first === 'string') return first;
  return first?.$ ?? '#';
}

export function extractAbstract(abstract?: string[]): string {
  return abstract?.[0] ?? '';
}

/** Extracts a human-readable date string from originInfo (prefers sortDate, then dateIssued start). */
export function extractStartDate(originInfo?: FraserOriginInfo): string {
  if (!originInfo) return '';
  if (originInfo.sortDate) return originInfo.sortDate;
  const issued = originInfo.dateIssued;
  if (!issued?.length) return '';
  const startEntry = issued.find(
    (d): d is { $: string; '@point'?: string } =>
      typeof d === 'object' && (d as { '@point'?: string })['@point'] === 'start',
  );
  if (startEntry) return startEntry.$;
  const first = issued[0];
  return typeof first === 'string' ? first : (first?.$ ?? '');
}

/** Extracts the string text from a name.namePart array (skips date objects). */
export function extractNameParts(namePart: (string | { $: string; '@type': string })[]): string {
  return namePart
    .filter((p): p is string => typeof p === 'string')
    .join(', ');
}

// ─── Timeline event helpers ───────────────────────────────────────────────────

export function getEventTitle(event: FraserTimelineEvent): string {
  return event.title ?? extractTitle(event.titleInfo);
}

export function getEventDate(event: FraserTimelineEvent): string {
  return event.date ?? extractStartDate(event.originInfo);
}

export function formatFraserDate(date: string, locale = 'en-US'): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = dateOnly
    ? new Date(Date.UTC(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ))
    : new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

export function getEventDescription(event: FraserTimelineEvent): string {
  return event.description ?? extractAbstract(event.abstract) ?? event.note?.[0] ?? '';
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function fraserFetch<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const url = `/api/fraser/${path}?${searchParams.toString()}`;

  const res = await fetch(url, { signal: withDeadline(signal, 20_000) });
  const data = await readBoundedResponseJson(res, 5 * 1024 * 1024).catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? `FRASER proxy error ${res.status}`,
    );
  }
  if (data === null) throw new Error('FRASER proxy returned malformed data.');
  return data as T;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export function getThemes(limit = 100, page = 1, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserTheme>>('theme', {
    limit: String(limit),
    page: String(page),
  }, signal);
}

export function getTheme(themeId: string | number, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserTheme>>(`theme/${themeId}`, {}, signal);
}

export function getThemeRecords(
  themeId: string | number,
  limit = 20,
  page = 1,
  signal?: AbortSignal,
) {
  return fraserFetch<FraserResponse<FraserRecord>>(`theme/${themeId}/records`, {
    limit: String(limit),
    page: String(page),
  }, signal);
}

// ─── Timelines ────────────────────────────────────────────────────────────────

export function getTimelines(limit = 100, page = 1, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserTimeline>>('timeline', {
    limit: String(limit),
    page: String(page),
  }, signal);
}

export function getTimeline(timelineId: string, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserTimeline>>(
    `timeline/${timelineId}`,
    {},
    signal,
  );
}

export function getTimelineEvents(
  timelineId: string,
  limit = 200,
  page = 1,
  signal?: AbortSignal,
) {
  return fraserFetch<FraserResponse<FraserTimelineEvent>>(`timeline/${timelineId}/events`, {
    limit: String(limit),
    page: String(page),
  }, signal);
}

// ─── Titles & Items ───────────────────────────────────────────────────────────

export function getTitle(titleId: string | number, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserRecord>>(`title/${titleId}`, {}, signal);
}

export function getTitleItems(
  titleId: string | number,
  limit = 20,
  page = 1,
  signal?: AbortSignal,
) {
  return fraserFetch<FraserResponse<FraserRecord>>(`title/${titleId}/items`, {
    limit: String(limit),
    page: String(page),
  }, signal);
}

export function getItem(itemId: string | number, signal?: AbortSignal) {
  return fraserFetch<FraserResponse<FraserRecord>>(`item/${itemId}`, {}, signal);
}
