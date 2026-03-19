'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Folder } from 'lucide-react';
import {
  useCategory,
  useCategoryChildren,
  useCategorySeries,
} from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { SeriesCard } from '@/components/search/SeriesCard';

export default function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const id = parseInt(categoryId, 10);
  const [offset, setOffset] = useState(0);

  const { toggle, isPinned } = usePinnedSeries();

  const { data: catData } = useCategory(id);
  const { data: childrenData } = useCategoryChildren(id);
  const { data: seriesData, isLoading: seriesLoading } = useCategorySeries(id, offset);

  const category = catData?.categories?.[0];
  const children = childrenData?.categories ?? [];
  const seriess = seriesData?.seriess ?? [];
  const totalSeries = seriesData?.count ?? 0;
  const totalPages = Math.ceil(totalSeries / 20);
  const currentPage = Math.floor(offset / 20) + 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/categories" className="hover:underline" style={{ color: 'var(--accent)' }}>
          Categories
        </Link>
        {category && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span style={{ color: 'var(--text)' }}>{category.name}</span>
          </>
        )}
      </nav>

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {category?.name ?? `Category ${id}`}
        </h1>
        {totalSeries > 0 && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {totalSeries.toLocaleString()} series in this category
          </p>
        )}
      </div>

      {/* Sub-categories */}
      {children.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
            Sub-categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/categories/${child.id}`}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors group"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <Folder className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
                  {child.name}
                </span>
                <ChevronRight
                  className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Series list */}
      {(seriesLoading || seriess.length > 0) && (
        <section>
          <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>
            Series in this Category
          </h2>

          {seriesLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 h-24 animate-pulse"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {seriess.map((s) => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  isPinned={isPinned(s.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - 20))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
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
                onClick={() => setOffset(offset + 20)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
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
        </section>
      )}
    </div>
  );
}
