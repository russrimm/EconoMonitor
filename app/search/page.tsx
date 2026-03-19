'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useSeriesSearch } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { SeriesCard } from '@/components/search/SeriesCard';

const PAGE_SIZE = 20;

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') ?? '');
  const [offset, setOffset] = useState(0);

  const { toggle, isPinned } = usePinnedSeries();
  const { data, isLoading, isFetching, error } = useSeriesSearch(debouncedQuery, offset);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Sync URL
  useEffect(() => {
    if (debouncedQuery) {
      router.replace(`/search?q=${encodeURIComponent(debouncedQuery)}`, { scroll: false });
    }
  }, [debouncedQuery, router]);

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const goTo = useCallback(
    (page: number) => {
      setOffset((page - 1) * PAGE_SIZE);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Search bar */}
      <div>
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
          Search FRED Series
        </h1>
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, series ID, or topic…"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          {(isLoading || isFetching) && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
              style={{ color: 'var(--accent)' }}
            />
          )}
        </div>
      </div>

      {/* Results count */}
      {data && debouncedQuery && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {data.count.toLocaleString()} result{data.count !== 1 ? 's' : ''} for &ldquo;
          {debouncedQuery}&rdquo;
          {totalPages > 1 && ` — page ${currentPage} of ${totalPages}`}
        </p>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' }}
        >
          {error.message}
        </div>
      )}

      {/* Empty prompt */}
      {!debouncedQuery && (
        <div
          className="rounded-xl p-10 text-center flex flex-col items-center gap-3"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
        >
          <Search className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>
            Try <strong>unemployment</strong>, <strong>GDP</strong>,{' '}
            <strong>inflation</strong>, or any FRED series ID
          </p>
        </div>
      )}

      {/* Results */}
      <div className="flex flex-col gap-3">
        {(data?.seriess ?? []).map((s) => (
          <SeriesCard
            key={s.id}
            series={s}
            isPinned={isPinned(s.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            ← Prev
          </button>
          <span className="text-sm px-2" style={{ color: 'var(--text-muted)' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
