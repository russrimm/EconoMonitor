'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Calendar,
} from 'lucide-react';
import { useFraserTitle, useTitleItems } from '@/hooks/useFraserQuery';
import {
  extractTitle,
  extractAbstract,
  extractUrl,
  extractStartDate,
  extractNameParts,
  type FraserRecord,
} from '@/lib/fraser';

const PAGE_SIZE = 20;

function ItemRow({ item }: { item: FraserRecord }) {
  const title = extractTitle(item.titleInfo);
  const date = extractStartDate(item.originInfo);
  const fraserUrl = extractUrl(item.location);
  const pdfUrl = item.location?.pdfUrl?.[0];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        {date && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {date}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: 'color-mix(in srgb, var(--red) 12%, transparent)',
              color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
            }}
          >
            PDF
          </a>
        )}
        {fraserUrl !== '#' && (
          <a
            href={fraserUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)' }}
            aria-label="View on FRASER"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function TitlePage() {
  const { titleId } = useParams<{ titleId: string }>();
  const [page, setPage] = useState(1);

  const titleQuery = useFraserTitle(titleId);
  const itemsQuery = useTitleItems(titleId, PAGE_SIZE, page);

  const title = titleQuery.data?.records?.[0];
  const items = itemsQuery.data?.records ?? [];
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const titleText = title ? extractTitle(title.titleInfo) : titleId;
  const abstract = title ? extractAbstract(title.abstract) : '';
  const fraserUrl = title ? extractUrl(title.location) : '#';
  const startDate = title ? extractStartDate(title.originInfo) : '';
  const frequency = title?.originInfo?.frequency;
  const issuance = title?.originInfo?.issuance;

  const creators =
    title?.name
      ?.filter((n) => n.role === 'creator')
      .map((n) => extractNameParts(n.namePart))
      .filter(Boolean) ?? [];

  const genres = title?.genre ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/fraser"
        className="inline-flex items-center gap-1.5 text-sm hover:underline self-start"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to FRASER
      </Link>

      {/* Title header */}
      {titleQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-3/4 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
          <div className="h-4 w-1/2 rounded animate-pulse" style={{ background: 'var(--surface)' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {titleText}
            </h1>
            {fraserUrl !== '#' && (
              <a
                href={fraserUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on FRASER
              </a>
            )}
          </div>

          {/* Metadata pills */}
          <div className="flex flex-wrap gap-2">
            {startDate && (
              <div
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                <Calendar className="w-3.5 h-3.5" />
                {startDate}
              </div>
            )}
            {frequency && (
              <div
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg capitalize"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {frequency}
              </div>
            )}
            {issuance && (
              <div
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg capitalize"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {issuance}
              </div>
            )}
            {genres.map((g, i) => (
              <div
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg capitalize"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {g}
              </div>
            ))}
          </div>

          {/* Creators */}
          {creators.length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {creators.join(' · ')}
              </p>
            </div>
          )}

          {/* Abstract */}
          {abstract && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {abstract}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Items
          </h2>
          {total > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {total.toLocaleString()} items
            </span>
          )}
        </div>

        {itemsQuery.error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--red) 10%, transparent)',
              color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
            }}
          >
            Failed to load items.
          </div>
        )}

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {itemsQuery.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse mx-4 my-3 rounded"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))
            : items.map((item, i) => <ItemRow key={i} item={item} />)}
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
