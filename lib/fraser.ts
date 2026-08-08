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
  description?: string | null;
  abstract?: string | null;
  created?: string | null;
  modified?: string | null;
}

export interface FraserTimelineImage {
  filename?: string | null;
  title?: string | null;
  caption?: string | null;
  source?: string | null;
  date?: string | null;
}

/**
 * FRASER timeline events are a bespoke flat shape, not the MODS envelope used by
 * titles, items, and themes.
 */
export interface FraserTimelineEvent {
  id: string | number;
  headline: string;
  date_start: string;
  date_end?: string | null;
  date_string?: string | null;
  description?: string | null;
  /** Pipe-separated `label@url` pairs. */
  links?: string | null;
  timeline_url?: string | null;
  sortOrder?: string | number | null;
  images?: FraserTimelineImage[] | null;
  av?: unknown[] | null;
  created?: string | null;
  modified?: string | null;
}

export interface FraserTimelineEventLink {
  label: string;
  url: string;
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

/** FRASER abstracts arrive as HTML, so return display-safe plain text. */
export function extractAbstract(abstract?: string[]): string {
  return stripHtml(abstract?.[0]);
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

const FRASER_ORIGIN = 'https://fraser.stlouisfed.org';

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201d',
  ldquo: '\u201c',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
};

/**
 * FRASER returns rich-text fields as HTML. Render them as plain text rather than
 * injecting markup, so untrusted upstream content can never execute.
 */
export function stripHtml(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const code = entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return HTML_ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\uFEFF/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function getEventTitle(event: FraserTimelineEvent): string {
  return stripHtml(event.headline) || 'Untitled';
}

export function getEventDate(event: FraserTimelineEvent): string {
  return event.date_start ?? '';
}

/** Prefers FRASER's own human-readable date label (e.g. "July 31, 2007"). */
export function getEventDateLabel(event: FraserTimelineEvent): string {
  const label = stripHtml(event.date_string);
  if (label) return label;
  const start = getEventDate(event);
  return start ? formatFraserDate(start) : '';
}

/** Parses FRASER's `label@url|label@url` link encoding into usable links. */
export function parseEventLinks(event: FraserTimelineEvent): FraserTimelineEventLink[] {
  if (!event.links) return [];
  return event.links
    .split('|')
    .map((entry) => {
      // Labels may contain "@", so anchor on the last separator followed by a URL.
      const match = /^([\s\S]*)@((?:https?:\/\/|\/)[\s\S]*)$/.exec(entry.trim());
      const [rawLabel, rawUrl] = match
        ? [match[1], match[2]]
        : ['', entry.trim()];
      const url = resolveFraserUrl(rawUrl.trim());
      if (!url) return null;
      return { label: stripHtml(rawLabel) || url, url };
    })
    .filter((link): link is FraserTimelineEventLink => link !== null);
}

function resolveFraserUrl(value: string): string | null {
  if (!value) return null;
  if (!/^(https?:\/\/|\/)/i.test(value)) return null;
  try {
    const url = new URL(value, FRASER_ORIGIN);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
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
  return stripHtml(event.description);
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
