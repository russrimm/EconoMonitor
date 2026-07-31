import type { AnalyzeDataset } from './ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExplainRequestBody {
  seriesId: string;
  label: string;
  units: string;
  focusDate: string;
  observations: { date: string; value: string }[];
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_MESSAGE_CHARS = 4_000;
export const MAX_ANALYZE_DATASETS = 6;
export const MAX_ANALYZE_OBSERVATIONS = 360;

const SERIES_ID_RE = /^[A-Z0-9_-]{1,30}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_VALUE_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;
const UNSAFE_MESSAGE_CHAR_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isSafeText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0) &&
    !CONTROL_CHAR_RE.test(value)
  );
}

function isSafeMessage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_CHAT_MESSAGE_CHARS &&
    !UNSAFE_MESSAGE_CHAR_RE.test(value)
  );
}

function isValidObservation(value: unknown): value is { date: string; value: string } {
  if (!value || typeof value !== 'object') return false;
  const observation = value as Record<string, unknown>;
  if (
    typeof observation.date !== 'string' ||
    !isValidIsoDate(observation.date) ||
    typeof observation.value !== 'string' ||
    observation.value.length > 32 ||
    !NUMERIC_VALUE_RE.test(observation.value)
  ) {
    return false;
  }
  return Number.isFinite(Number(observation.value));
}

export function validateChatMessages(body: unknown): ValidationResult<ChatMessage[]> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be { messages: ChatMessage[] }.' };
  }
  const messages = (body as Record<string, unknown>).messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_CHAT_MESSAGES
  ) {
    return {
      ok: false,
      error: `Provide between 1 and ${MAX_CHAT_MESSAGES} messages.`,
    };
  }

  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return { ok: false, error: 'Each message must contain a valid role and content.' };
    }
    const candidate = message as Record<string, unknown>;
    if (
      (candidate.role !== 'user' && candidate.role !== 'assistant') ||
      !isSafeMessage(candidate.content)
    ) {
      return {
        ok: false,
        error: `Each message must have role "user" or "assistant" and 1-${MAX_CHAT_MESSAGE_CHARS} characters of text.`,
      };
    }
  }

  return { ok: true, value: messages as ChatMessage[] };
}

export function validateAnalyzeDatasets(
  body: unknown,
): ValidationResult<AnalyzeDataset[]> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be { datasets: AnalyzeDataset[] }.' };
  }
  const datasets = (body as Record<string, unknown>).datasets;
  if (
    !Array.isArray(datasets) ||
    datasets.length === 0 ||
    datasets.length > MAX_ANALYZE_DATASETS
  ) {
    return {
      ok: false,
      error: `Provide between 1 and ${MAX_ANALYZE_DATASETS} datasets.`,
    };
  }

  for (const value of datasets) {
    if (!value || typeof value !== 'object') {
      return { ok: false, error: 'Each dataset must be an object.' };
    }
    const dataset = value as Record<string, unknown>;
    if (typeof dataset.seriesId !== 'string' || !SERIES_ID_RE.test(dataset.seriesId)) {
      return { ok: false, error: 'Each dataset must have a valid seriesId.' };
    }
    if (!isSafeText(dataset.label, 200) || !isSafeText(dataset.units, 100, true)) {
      return {
        ok: false,
        error: 'Dataset labels and units must be bounded plain text.',
      };
    }
    if (
      !Array.isArray(dataset.observations) ||
      dataset.observations.length === 0 ||
      dataset.observations.length > MAX_ANALYZE_OBSERVATIONS ||
      !dataset.observations.every(isValidObservation)
    ) {
      return {
        ok: false,
        error: `Each dataset must contain 1-${MAX_ANALYZE_OBSERVATIONS} finite, dated observations.`,
      };
    }
  }

  return { ok: true, value: datasets as AnalyzeDataset[] };
}

export function validateExplainBody(
  body: unknown,
): ValidationResult<ExplainRequestBody> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be an object.' };
  }
  const candidate = body as Partial<ExplainRequestBody>;
  if (typeof candidate.seriesId !== 'string' || !SERIES_ID_RE.test(candidate.seriesId)) {
    return { ok: false, error: 'Invalid seriesId.' };
  }
  if (!isSafeText(candidate.label, 200) || !isSafeText(candidate.units, 100, true)) {
    return { ok: false, error: 'Invalid label or units.' };
  }
  if (typeof candidate.focusDate !== 'string' || !isValidIsoDate(candidate.focusDate)) {
    return { ok: false, error: 'focusDate must be a valid YYYY-MM-DD date.' };
  }
  if (
    !Array.isArray(candidate.observations) ||
    candidate.observations.length === 0 ||
    candidate.observations.length > 60 ||
    !candidate.observations.every(isValidObservation)
  ) {
    return {
      ok: false,
      error: 'observations must contain 1-60 finite values with valid ISO dates.',
    };
  }

  return { ok: true, value: candidate as ExplainRequestBody };
}
