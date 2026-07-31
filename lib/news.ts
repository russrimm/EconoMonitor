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

export function isNewsTopic(value: string | null): value is NewsTopic {
  return NEWS_TOPICS.some((topic) => topic === value);
}

export async function getLatestNews(topic: NewsTopic): Promise<NewsResponse> {
  const response = await fetch(`/api/news?topic=${encodeURIComponent(topic)}`);
  const data: unknown = await response.json();

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

  return data as NewsResponse;
}
