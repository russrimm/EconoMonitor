import { NextRequest, NextResponse } from 'next/server';
import {
  isNewsTopic,
  parseFederalReserveUrl,
  parseGdeltArticle,
  type NewsArticle,
  type NewsResponse,
  type NewsTopic,
} from '@/lib/news';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
  readLimitedText,
} from '@/lib/upstream';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const FEDERAL_RESERVE_RSS =
  'https://www.federalreserve.gov/feeds/press_all.xml';
const CACHE_SECONDS = 15 * 60;
const MAX_GDELT_BYTES = 512 * 1024;
const MAX_FED_BYTES = 256 * 1024;

const TOPIC_QUERIES: Record<NewsTopic, string> = {
  all: '("stock market" OR "financial markets" OR "interest rates" OR inflation OR earnings)',
  markets: '("stock market" OR stocks OR bonds OR commodities)',
  economy: '(economy OR inflation OR "interest rates" OR employment)',
  business: '(earnings OR merger OR acquisition OR IPO)',
};

async function fetchGdeltNews(
  topic: NewsTopic,
  signal: AbortSignal,
): Promise<NewsArticle[]> {
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

  const upstream = await fetchUpstream(gdeltUrl, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  }, {
    service: 'gdelt',
    operation: 'article-list',
    timeoutMs: 10_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, MAX_GDELT_BYTES);
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as { articles?: unknown }).articles)
  ) {
    logInvalidPayload(upstream);
    throw new Error('upstream response did not contain articles');
  }

  const sourceArticles = (data as { articles: unknown[] }).articles.slice(0, 100);
  const articles = sourceArticles
    .map(parseGdeltArticle)
    .filter((article): article is NewsArticle => article !== null);
  if (articles.length !== sourceArticles.length) {
    logInvalidPayload(upstream);
    throw new Error('upstream articles were malformed');
  }
  logUpstreamSuccess(upstream);
  return articles;
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

async function fetchFederalReserveNews(signal: AbortSignal): Promise<NewsArticle[]> {
  const upstream = await fetchUpstream(FEDERAL_RESERVE_RSS, {
    headers: { Accept: 'application/rss+xml, application/xml' },
    cache: 'no-store',
    signal,
  }, {
    service: 'federal_reserve',
    operation: 'press-release-feed',
    timeoutMs: 10_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!/(xml|rss)/i.test(contentType)) {
    logInvalidPayload(upstream);
    throw new Error('upstream response was not XML');
  }
  const xml = await readLimitedText(upstream, MAX_FED_BYTES);
  if (!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml)) {
    logInvalidPayload(upstream);
    throw new Error('upstream response was not an RSS feed');
  }
  const sourceItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const articles = sourceItems
    .map((match): NewsArticle | null => {
      const title = extractXmlText(match[1], 'title');
      const link = extractXmlText(match[1], 'link');
      const published = extractXmlText(match[1], 'pubDate');
      const safeLink = link ? parseFederalReserveUrl(link) : null;
      if (!title || !safeLink || !published) return null;

      const publishedAt = new Date(published);
      if (Number.isNaN(publishedAt.getTime())) return null;

      return {
        url: safeLink,
        title,
        publishedAt: publishedAt.toISOString(),
        source: 'Federal Reserve',
        sourceCountry: 'United States',
      };
    })
    .filter((article): article is NewsArticle => article !== null);
  if (articles.length !== sourceItems.length) {
    logInvalidPayload(upstream);
    throw new Error('upstream feed items were malformed');
  }
  logUpstreamSuccess(upstream);
  return articles;
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
  const includeFed = topic === 'all' || topic === 'economy';
  const [gdeltResult, fedResult] = await Promise.allSettled([
    fetchGdeltNews(topic, request.signal),
    includeFed
      ? fetchFederalReserveNews(request.signal)
      : Promise.resolve<NewsArticle[]>([]),
  ]);

  if (
    gdeltResult.status === 'rejected' &&
    (!includeFed || fedResult.status === 'rejected')
  ) {
    return NextResponse.json(
      { error: 'Unable to contact the financial news services.' },
      { status: 502 },
    );
  }

  const gdeltArticles =
    gdeltResult.status === 'fulfilled' ? gdeltResult.value : [];
  const fedArticles =
    includeFed &&
    fedResult.status === 'fulfilled'
      ? fedResult.value
      : [];
  const providers = [
    ...(gdeltResult.status === 'fulfilled' ? ['GDELT'] : []),
    ...(includeFed && fedResult.status === 'fulfilled' ? ['Federal Reserve'] : []),
  ];
  const response: NewsResponse = {
    articles: deduplicateAndSort([...gdeltArticles, ...fedArticles]),
    updatedAt: new Date().toISOString(),
    providers,
    partial:
      gdeltResult.status === 'rejected' ||
      (includeFed && fedResult.status === 'rejected'),
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': response.partial
        ? 'no-store'
        : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
    },
  });
}
