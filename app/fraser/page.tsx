'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, Key, Search } from 'lucide-react';
import { useThemes, useTimelines } from '@/hooks/useFraserQuery';
import {
  extractTitle,
  extractId,
  extractAbstract,
  extractUrl,
  type FraserTheme,
  type FraserTimeline,
} from '@/lib/fraser';

function ThemeCard({ theme }: { theme: FraserTheme }) {
  const id = extractId(theme.recordInfo);
  const title = extractTitle(theme.titleInfo);
  const abstract = extractAbstract(theme.abstract);
  const fraserUrl = extractUrl(theme.location);
  const topics = theme.subject?.topic?.slice(0, 4) ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/fraser/themes/${id}`}
          className="text-sm font-semibold leading-snug hover:underline"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </Link>

      </div>

      {abstract && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {abstract}
        </p>
      )}

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topics.map((t, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {t.topic}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/fraser/themes/${id}`}
        className="mt-auto text-xs font-medium hover:underline self-start"
        style={{ color: 'var(--accent)' }}
      >
        Explore →
      </Link>
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: FraserTimeline }) {
  const blurb = timeline.abstract || timeline.description;
  return (
    <Link
      href={`/fraser/timelines/${timeline.id}`}
      className="flex flex-col gap-2 rounded-xl p-4 transition-colors group"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--blue)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {timeline.title}
        </span>
      </div>
      {blurb && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {blurb}
        </p>
      )}
    </Link>
  );
}

export default function FraserPage() {
  const themes = useThemes();
  const timelines = useTimelines();
  const [themeFilter, setThemeFilter] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('');

  const apiKeyMissing =
    (themes.error instanceof Error && themes.error.message.includes('not configured')) ||
    (timelines.error instanceof Error && timelines.error.message.includes('not configured'));

  const allThemes = themes.data?.records ?? [];
  const allTimelines = timelines.data?.records ?? [];
  const loading = themes.isLoading || timelines.isLoading;

  const themeList = themeFilter.trim()
    ? allThemes.filter((t) => {
        const q = themeFilter.toLowerCase();
        const title = extractTitle(t.titleInfo).toLowerCase();
        const abstract = extractAbstract(t.abstract).toLowerCase();
        const topics = (t.subject?.topic ?? []).map((tp) => tp.topic.toLowerCase()).join(' ');
        return title.includes(q) || abstract.includes(q) || topics.includes(q);
      })
    : allThemes;

  const timelineList = timelineFilter.trim()
    ? allTimelines.filter((tl) => {
        const q = timelineFilter.toLowerCase();
        return (
          tl.title.toLowerCase().includes(q) ||
          (tl.abstract ?? '').toLowerCase().includes(q) ||
          (tl.description ?? '').toLowerCase().includes(q)
        );
      })
    : allTimelines;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--blue) 15%, transparent)' }}
          >
            <BookOpen className="w-5 h-5" style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Historical Archives
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Federal Reserve Archival System for Economic Research
            </p>
          </div>
        </div>
        <p className="text-sm mt-1 max-w-2xl leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          FRASER is a digital library of U.S. economic, financial, and banking history — curated
          by the Federal Reserve Bank of St. Louis. Browse historical publications, Federal Reserve
          documents, congressional hearings, banking statistics, and more organized into themed
          collections and chronological event timelines.
        </p>
        <a
          href="https://fraser.stlouisfed.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs mt-1 hover:underline self-start"
          style={{ color: 'var(--accent)' }}
        >
          <ExternalLink className="w-3 h-3" />
          Visit fraser.stlouisfed.org
        </a>
      </div>

      {/* API key setup notice */}
      {apiKeyMissing && (
        <div
          className="rounded-xl p-4 flex gap-3"
          style={{
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          }}
        >
          <Key className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              FRASER API key required
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Request a free API key by sending a POST request with your email:
            </p>
            <code
              className="text-xs px-2 py-1.5 rounded block break-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {'curl --data \'{"email":"you@example.com","description":"EconoMonitor"}\' https://fraser.stlouisfed.org/api/api_key'}
            </code>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Then add{' '}
              <code className="text-xs" style={{ color: 'var(--text)' }}>
                FRASER_API_KEY=your_key
              </code>{' '}
              to your <code style={{ color: 'var(--text)' }}>.env.local</code> and restart the dev server.
            </p>
          </div>
        </div>
      )}

      {/* Generic error */}
      {!apiKeyMissing && (themes.error || timelines.error) && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          }}
        >
          Failed to load FRASER data. Please try again.
        </div>
      )}

      {/* Themes */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Browse Themes
          </h2>
          {allThemes.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {themeFilter.trim() ? `${themeList.length} of ${allThemes.length}` : `${allThemes.length}`} collections
            </span>
          )}
        </div>

        {/* Theme filter */}
        {allThemes.length > 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              placeholder="Filter themes…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-36 animate-pulse"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : themeList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {themeList.map((theme) => (
              <ThemeCard key={extractId(theme.recordInfo)} theme={theme} />
            ))}
          </div>
        ) : !apiKeyMissing ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {themeFilter.trim() ? `No themes match "${themeFilter}".` : 'No themes found.'}
          </p>
        ) : null}
      </section>

      {/* Timelines */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Historical Timelines
          </h2>
          {allTimelines.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {timelineFilter.trim() ? `${timelineList.length} of ${allTimelines.length}` : `${allTimelines.length}`} timelines
            </span>
          )}
        </div>

        {/* Timeline filter */}
        {allTimelines.length > 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
              placeholder="Filter timelines…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-16 animate-pulse"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
        ) : timelineList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {timelineList.map((tl) => (
              <TimelineCard key={tl.id} timeline={tl} />
            ))}
          </div>
        ) : !apiKeyMissing ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {timelineFilter.trim() ? `No timelines match "${timelineFilter}".` : 'No timelines found.'}
          </p>
        ) : null}
      </section>
    </div>
  );
}
