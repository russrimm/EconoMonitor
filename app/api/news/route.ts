import { NextRequest, NextResponse } from 'next/server';
import {
  isNewsTopic,
  type NewsArticle,
  type NewsResponse,
  type NewsTopic,
} from '@/lib/news';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const FEDERAL_RESERVE_RSS =
  'https://www.federalreserve.gov/feeds/press_all.xml';
const CACHE_SECONDS = 15 * 60;

const TOPIC_QUERIES: Record<NewsTopic, string> = {
  all: '("stock market" OR "financial markets" OR "interest rates" OR inflation OR earnings)',
  markets: '("stock market" OR stocks OR bonds OR commodities)',
  economy: '(economy OR inflation OR "interest rates" OR employment)',
  business: '(earnings OR merger OR acquisition OR IPO)',
};

interface GdeltArticle {
  url?: unknown;
  title?: unknown;
  seendate?: unknown;
  domain?: unknown;
  sourcecountry?: unknown;
  language?: unknown;
}

interface GdeltResponse {
  articles?: unknown;
}

function parseGdeltDate(value: string): string | null {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseArticle(value: GdeltArticle): NewsArticle | null {
  if (
    typeof value.url !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.seendate !== 'string' ||
    typeof value.domain !== 'string'
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    return null;
  }

  const publishedAt = parseGdeltDate(value.seendate);
  const title = value.title.trim();
  if (!publishedAt || !title || !['http:', 'https:'].includes(url.protocol)) {
    return null;
  }

  return {
    url: url.toString(),
    title,
    publishedAt,
    source: value.domain.replace(/^www\./, ''),
    sourceCountry:
      typeof value.sourcecountry === 'string' && value.sourcecountry.trim()
        ? value.sourcecountry.trim()
        : null,
  };
}

async function fetchGdeltNews(topic: NewsTopic): Promise<NewsArticle[]> {
  const gdeltUrl = new URL(GDELT_DOC_API);

  gdeltUrl.searchParams.set(
    'query',
    `${TOPIC_QUERIES[topic]} sourcelang:english`,
  );
  gdeltUrl.searchParams.set('mode', 'ArtList');
  gdeltUrl.searchParams.set('maxrecords', '50');
  gdeltUrl.searchParams.set('format', 'json');
  gdeltUrl.searchParams.set('sort', 'DateDesc');
  gdeltUrl.searchParams.set('timespan', '3days');

  const upstream = await fetch(gdeltUrl, {
    headers: { Accept: 'application/json' },
    next: { revalidate: CACHE_SECONDS },
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = (await upstream.json()) as GdeltResponse;
  if (!Array.isArray(data.articles)) {
    throw new Error('upstream response did not contain articles');
  }

  return data.articles
    .map((article) => parseArticle(article as GdeltArticle))
    .filter((article): article is NewsArticle => article !== null);
}

function decodeXml(value: string): string {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function extractXmlText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

async function fetchFederalReserveNews(): Promise<NewsArticle[]> {
  const upstream = await fetch(FEDERAL_RESERVE_RSS, {
    headers: { Accept: 'application/rss+xml, application/xml' },
    next: { revalidate: CACHE_SECONDS },
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const xml = await upstream.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match): NewsArticle | null => {
      const title = extractXmlText(match[1], 'title');
      const link = extractXmlText(match[1], 'link');
      const published = extractXmlText(match[1], 'pubDate');
      if (!title || !link || !published) return null;

      const publishedAt = new Date(published);
      if (Number.isNaN(publishedAt.getTime())) return null;

      return {
        url: link,
        title,
        publishedAt: publishedAt.toISOString(),
        source: 'Federal Reserve',
        sourceCountry: 'United States',
      };
    })
    .filter((article): article is NewsArticle => article !== null);
}

function deduplicateAndSort(articles: NewsArticle[]): NewsArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return articles
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime(),
    )
    .filter((article) => {
      const normalizedTitle = article.title.toLocaleLowerCase();
      if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenUrls.add(article.url);
      seenTitles.add(normalizedTitle);
      return true;
    })
    .slice(0, 30);
}

export async function GET(request: NextRequest) {
  const requestedTopic = request.nextUrl.searchParams.get('topic');
  const topic = isNewsTopic(requestedTopic) ? requestedTopic : 'all';
  const [gdeltResult, fedResult] = await Promise.allSettled([
    fetchGdeltNews(topic),
    fetchFederalReserveNews(),
  ]);

  if (gdeltResult.status === 'rejected') {
    console.error('[GDELT news] fetch failed:', gdeltResult.reason);
  }
  if (fedResult.status === 'rejected') {
    console.error('[Federal Reserve news] fetch failed:', fedResult.reason);
  }

  if (gdeltResult.status === 'rejected' && fedResult.status === 'rejected') {
    return NextResponse.json(
      { error: 'Unable to contact the financial news services.' },
      { status: 502 },
    );
  }

  const gdeltArticles =
    gdeltResult.status === 'fulfilled' ? gdeltResult.value : [];
  const fedArticles =
    fedResult.status === 'fulfilled' &&
    (topic === 'all' ||
      topic === 'economy' ||
      gdeltResult.status === 'rejected')
      ? fedResult.value
      : [];
  const providers = [
    ...(gdeltResult.status === 'fulfilled' ? ['GDELT'] : []),
    ...(fedArticles.length > 0 ? ['Federal Reserve'] : []),
  ];
  const response: NewsResponse = {
    articles: deduplicateAndSort([...gdeltArticles, ...fedArticles]),
    updatedAt: new Date().toISOString(),
    providers,
    partial:
      gdeltResult.status === 'rejected' || fedResult.status === 'rejected',
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
