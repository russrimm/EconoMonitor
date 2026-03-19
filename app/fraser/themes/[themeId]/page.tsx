'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Search, Tag } from 'lucide-react';
import { useFraserTheme, useThemeRecords } from '@/hooks/useFraserQuery';
import {
  extractTitle,
  extractId,
  extractAbstract,
  extractUrl,
  extractStartDate,
  type FraserRecord,
} from '@/lib/fraser';

const PAGE_SIZE = 20;

function RecordRow({ record }: { record: FraserRecord }) {
  const title = extractTitle(record.titleInfo);
  const type = record.recordInfo?.recordType ?? 'item';
  const id = extractId(record.recordInfo);
  const fraserUrl = extractUrl(record.location);
  const date = extractStartDate(record.originInfo);
  const isTitle = type === 'title';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
      <div className="flex-1 min-w-0">
        {isTitle ? (
          <Link
            href={`/fraser/title/${id}`}
            className="text-sm font-medium hover:underline leading-snug"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </Link>
        ) : (
          <a
            href={fraserUrl !== '#' ? fraserUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline leading-snug"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </a>
        )}
        {date && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {date}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
          }}
        >
          {type}
        </span>

      </div>
    </div>
  );
}

export default function ThemePage() {
  const { themeId } = useParams<{ themeId: string }>();
  const [page, setPage] = useState(1);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'title' | 'item'>('all');

  const themeQuery = useFraserTheme(themeId);
  const recordsQuery = useThemeRecords(themeId, PAGE_SIZE, page);

  const theme = themeQuery.data?.records?.[0];
  const allRecords = recordsQuery.data?.records ?? [];
  const total = recordsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const records = allRecords.filter((rec) => {
    const recType = rec.recordInfo?.recordType ?? 'item';
    const matchType = typeFilter === 'all' || recType === typeFilter;
    const matchKeyword = keywordFilter.trim()
      ? extractTitle(rec.titleInfo).toLowerCase().includes(keywordFilter.toLowerCase())
      : true;
    return matchType && matchKeyword;
  });

  const title = theme ? extractTitle(theme.titleInfo) : themeId;
  const abstract = theme ? extractAbstract(theme.abstract) : '';
  const fraserUrl = theme ? extractUrl(theme.location) : '#';
  const topics = theme?.subject?.topic ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/fraser"
        className="inline-flex items-center gap-1.5 text-sm hover:underline self-start"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Archives
      </Link>

      {/* Theme header */}
      <div className="flex flex-col gap-3">
        {themeQuery.isLoading ? (
          <div className="h-8 w-64 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
        ) : (
          <>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {fraserUrl !== '#' ? (
                <a
                  href={fraserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {title}
                </a>
              ) : title}
            </h1>

            {abstract && (
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: 'var(--text-muted)' }}>
                {abstract}
              </p>
            )}

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <Tag className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                {topics.map((t, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
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
          </>
        )}
      </div>

      {/* Records */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Records in this Theme
          </h2>
          {total > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {(keywordFilter.trim() || typeFilter !== 'all') ? `${records.length} of ` : ''}{total.toLocaleString()} total
            </span>
          )}
        </div>

        {/* Filters */}
        {allRecords.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Keyword filter */}
            <div className="relative min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <input
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Filter records…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
            {/* Type chips */}
            {(['all', 'title', 'item'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors"
                style={{
                  background: typeFilter === t ? 'var(--accent)' : 'var(--surface)',
                  color: typeFilter === t ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${typeFilter === t ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {t === 'all' ? 'All types' : t === 'title' ? 'Titles' : 'Items'}
              </button>
            ))}
          </div>
        )}

        {recordsQuery.error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--red) 10%, transparent)',
              color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
            }}
          >
            Failed to load records.
          </div>
        )}

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {recordsQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse mx-4 my-3 rounded"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))
            : records.length > 0
              ? records.map((rec, i) => <RecordRow key={i} record={rec} />)
              : (
                <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  {keywordFilter.trim() || typeFilter !== 'all'
                    ? 'No records match the current filters.'
                    : 'No records found.'}
                </p>
              )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
