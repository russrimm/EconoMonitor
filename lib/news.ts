import {
  readBoundedResponseJson,
  withDeadline,
} from './responseBody.ts';

export const NEWS_TOPICS = ['all', 'markets', 'economy', 'business'] as const;

export type NewsTopic = (typeof NEWS_TOPICS)[number];

export interface NewsArticle {
  url: string;
  title: string;
  publishedAt: string;
  source: string;
  sourceCountry: string | null;
}

export interface NewsResponse {
  articles: NewsArticle[];
  updatedAt: string;
  providers: string[];
  partial: boolean;
}

export interface GdeltArticle {
  url?: unknown;
  title?: unknown;
  seendate?: unknown;
  sourcecountry?: unknown;
}

export function isNewsTopic(value: string | null): value is NewsTopic {
  return NEWS_TOPICS.some((topic) => topic === value);
}

export function parseGdeltDate(value: string): string | null {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }
  return date.toISOString();
}

export function parseGdeltArticle(value: unknown): NewsArticle | null {
  const article = value as GdeltArticle | null;
  if (
    typeof article !== 'object' ||
    article === null ||
    typeof article.url !== 'string' ||
    typeof article.title !== 'string' ||
    typeof article.seendate !== 'string'
  ) {
    return null;
  }

  const articleUrl = article.url;
  const articleTitle = article.title;
  const articleSeenDate = article.seendate;
  let url: URL;
  try {
    url = new URL(articleUrl);
  } catch {
    return null;
  }
  const publishedAt = parseGdeltDate(articleSeenDate);
  const title = articleTitle.trim();
  if (
    !publishedAt ||
    !title ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    return null;
  }

  return {
    url: url.toString(),
    title,
    publishedAt,
    source: url.hostname.replace(/^www\./, ''),
    sourceCountry:
      typeof article.sourcecountry === 'string' && article.sourcecountry.trim()
        ? article.sourcecountry.trim()
        : null,
  };
}

export function parseFederalReserveUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !['federalreserve.gov', 'www.federalreserve.gov'].includes(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isNewsResponse(value: unknown): value is NewsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<NewsResponse>;
  return (
    Array.isArray(candidate.articles) &&
    candidate.articles.length <= 30 &&
    candidate.articles.every((article) =>
      typeof article === 'object' &&
      article !== null &&
      typeof article.url === 'string' &&
      typeof article.title === 'string' &&
      typeof article.publishedAt === 'string' &&
      typeof article.source === 'string' &&
      (article.sourceCountry === null ||
        typeof article.sourceCountry === 'string') &&
      Number.isFinite(Date.parse(article.publishedAt))
    ) &&
    typeof candidate.updatedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Array.isArray(candidate.providers) &&
    candidate.providers.every((provider) => typeof provider === 'string') &&
    typeof candidate.partial === 'boolean'
  );
}

export async function getLatestNews(
  topic: NewsTopic,
  signal?: AbortSignal,
): Promise<NewsResponse> {
  const response = await fetch(`/api/news?topic=${encodeURIComponent(topic)}`, {
    signal: withDeadline(signal, 20_000),
  });
  const data = await readBoundedResponseJson(response, 512 * 1024).catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Failed to load financial news.';
    throw new Error(message);
  }

  if (!isNewsResponse(data)) {
    throw new Error('The financial news service returned malformed data.');
  }
  return data;
}
