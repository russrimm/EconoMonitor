'use client';

import Link from 'next/link';
import { ChevronRight, Folder } from 'lucide-react';
import { useCategoryChildren } from '@/hooks/useFredQuery';

// FRED root category ID is 0
const ROOT_ID = 0;

export default function CategoriesPage() {
  const { data, isLoading, error } = useCategoryChildren(ROOT_ID);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Browse Categories
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Explore economic data organized by topic
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            color: 'var(--red)',
            border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
          }}
        >
          Failed to load categories. Please try again.
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 h-16 animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data?.categories ?? []).map((cat) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.id}`}
            className="flex items-center gap-3 p-4 rounded-xl transition-colors group"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <Folder
              className="w-5 h-5 shrink-0 transition-colors"
              style={{ color: 'var(--accent)' }}
            />
            <span
              className="text-sm font-medium flex-1 leading-snug"
              style={{ color: 'var(--text)' }}
            >
              {cat.name}
            </span>
            <ChevronRight
              className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
