'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, Newspaper, Radio, RefreshCw } from 'lucide-react';
import {
  getLatestNews,
  NEWS_TOPICS,
  type NewsTopic,
} from '@/lib/news';
import { QueryError } from '@/components/QueryError';

const TOPIC_LABELS: Record<NewsTopic, string> = {
  all: 'Top stories',
  markets: 'Markets',
  economy: 'Economy',
  business: 'Business',
};

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTime(value: string): string {
  const elapsedMinutes = Math.round(
    (new Date(value).getTime() - Date.now()) / 60_000,
  );

  if (Math.abs(elapsedMinutes) < 60) {
    return relativeTime.format(elapsedMinutes, 'minute');
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeTime.format(elapsedHours, 'hour');
  }

  return relativeTime.format(Math.round(elapsedHours / 24), 'day');
}

export default function NewsPage() {
  const [topic, setTopic] = useState<NewsTopic>('all');
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['financial-news', topic],
    queryFn: ({ signal }) => getLatestNews(topic, signal),
    staleTime: 60 * 1000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Financial News
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Latest English-language finance and economic headlines from global
            publishers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {NEWS_TOPICS.map((value) => {
          const active = topic === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTopic(value)}
              aria-pressed={active}
              className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
              style={{
                background: active
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'var(--surface)',
                border: active
                  ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)'
                  : '1px solid var(--border)',
                color: active ? 'var(--accent-hover)' : 'var(--text-muted)',
              }}
            >
              {TOPIC_LABELS[value]}
            </button>
          );
        })}
      </div>

      {error && (
        <QueryError
          message={
            error instanceof Error
              ? error.message
              : 'Financial news could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      )}

      {data?.partial && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          role="status"
          style={{
            background: 'color-mix(in srgb, var(--blue) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
            color: 'var(--text-muted)',
          }}
        >
          One news provider is temporarily unavailable.
          {data.providers.length > 0 &&
            ` Showing the latest headlines from ${data.providers.join(' and ')}.`}
        </div>
      )}

      <section
        className="rounded-xl overflow-hidden"
        aria-busy={isFetching}
        style={{ border: '1px solid var(--border)' }}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {isFetching ? 'Refreshing financial news.' : 'Financial news updated.'}
        </span>
        {isLoading
          ? Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="p-4"
                style={{
                  background: 'var(--surface)',
                  borderTop:
                    index > 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div
                  className="h-4 rounded animate-pulse w-3/4"
                  style={{ background: 'var(--border)' }}
                />
                <div
                  className="h-3 rounded animate-pulse w-1/4 mt-3"
                  style={{ background: 'var(--border)' }}
                />
              </div>
            ))
          : data?.articles.map((article, index) => (
              <article
                key={article.url}
                className="p-4"
                style={{
                  background: 'var(--surface)',
                  borderTop:
                    index > 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-4"
                >
                  <div>
                    <h2
                      className="font-semibold leading-snug group-hover:underline"
                      style={{ color: 'var(--text)' }}
                    >
                      {article.title}
                    </h2>
                    <div
                      className="flex items-center gap-3 flex-wrap mt-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        <Radio className="w-3.5 h-3.5" />
                        {article.source}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <time
                          dateTime={article.publishedAt}
                          title={new Date(article.publishedAt).toLocaleString()}
                        >
                          {formatRelativeTime(article.publishedAt)}
                        </time>
                      </span>
                      {article.sourceCountry && (
                        <span>{article.sourceCountry}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink
                    className="w-4 h-4 shrink-0 mt-1"
                    aria-hidden="true"
                    style={{ color: 'var(--accent)' }}
                  />
                </a>
              </article>
            ))}

        {!isLoading && !error && data?.articles.length === 0 && (
          <div className="p-10 text-center" style={{ background: 'var(--surface)' }}>
            <p className="font-medium" style={{ color: 'var(--text)' }}>
              No recent stories found
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Try another topic or refresh in a few minutes.
            </p>
          </div>
        )}
      </section>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Headlines are discovered through the{' '}
        <a
          href="https://www.gdeltproject.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          GDELT Project
        </a>
        {' '}and the{' '}
        <a
          href="https://www.federalreserve.gov/feeds/feeds.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Federal Reserve RSS feeds
        </a>
        . Articles remain on their publishers&apos; websites.
      </p>
    </div>
  );
}
