'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpDown, ChevronRight, Folder, LayoutGrid, Loader2, Search } from 'lucide-react';
import { useCategoryChildren, useSeriesSearch } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { SeriesCard } from '@/components/search/SeriesCard';

const PAGE_SIZE = 20;

type CategoryCrumb = { id: number; name: string };

function CategoryBrowser() {
  const [path, setPath] = useState<CategoryCrumb[]>([]);
  const currentId = path.at(-1)?.id ?? 0;
  const { data, isLoading } = useCategoryChildren(currentId);
  const categories = data?.categories ?? [];
  const isLeaf = !isLoading && path.length > 0 && categories.length === 0;

  function drill(cat: CategoryCrumb) {
    setPath((prev) => [...prev, cat]);
  }

  function goToIndex(i: number) {
    setPath((prev) => prev.slice(0, i + 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Browse by Topic
        </span>
      </div>

      {/* Breadcrumb trail */}
      {path.length > 0 && (
        <nav className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setPath([])}
            className="text-xs hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            All Topics
          </button>
          {path.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              {i < path.length - 1 ? (
                <button
                  onClick={() => goToIndex(i)}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {crumb.name}
                </button>
              ) : (
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {crumb.name}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      )}

      {/* Leaf node — navigate to category series page */}
      {isLeaf && (
        <Link
          href={`/categories/${path.at(-1)!.id}`}
          className="flex items-center gap-3 p-4 rounded-xl transition-colors group"
          style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}
        >
          <Folder className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
            Browse series in &ldquo;{path.at(-1)!.name}&rdquo; &rarr;
          </span>
        </Link>
      )}

      {/* Sub-category grid */}
      {!isLoading && categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => drill({ id: cat.id, name: cat.name })}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition-all group"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <Folder className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium flex-1 leading-snug" style={{ color: 'var(--text)' }}>
                {cat.name}
              </span>
              <ChevronRight
                className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') ?? '');
  const [offset, setOffset] = useState(0);
  const [orderBy, setOrderBy] = useState<'popularity' | 'last_updated' | 'title'>('popularity');

  const { toggle, isPinned } = usePinnedSeries();
  const { data, isLoading, isFetching, error } = useSeriesSearch(debouncedQuery, offset, orderBy);

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
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-60 max-w-xl">
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
          {/* Sort selector */}
          {debouncedQuery && (
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <select
                aria-label="Sort results by"
                value={orderBy}
                onChange={(e) => {
                  setOrderBy(e.target.value as typeof orderBy);
                  setOffset(0);
                }}
                className="text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 appearance-none cursor-pointer pr-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <option value="popularity">Popularity</option>
                <option value="last_updated">Most Recent</option>
                <option value="title">A → Z</option>
              </select>
            </div>
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

      {/* Browse by topic when no query */}
      {!debouncedQuery && <CategoryBrowser />}

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
