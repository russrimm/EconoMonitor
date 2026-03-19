'use client';

import Link from 'next/link';
import { Pin, PinOff, ExternalLink } from 'lucide-react';
import type { FredSeries } from '@/lib/fred';
import { formatDate } from '@/lib/utils';

interface Props {
  series: FredSeries;
  isPinned: boolean;
  onToggle: (id: string) => void;
}

export function SeriesCard({ series, isPinned, onToggle }: Props) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-colors hover:border-emerald-500/50"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {series.id}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              {series.frequency_short}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              {series.seasonal_adjustment_short}
            </span>
          </div>
          <Link
            href={`/series/${series.id}`}
            className="mt-1.5 block text-base font-semibold hover:underline"
            style={{ color: 'var(--text)' }}
          >
            {series.title}
          </Link>
          <p
            className="text-sm mt-0.5 line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {series.notes?.replace(/\r?\n/g, ' ') ?? series.units}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => onToggle(series.id)}
            title={isPinned ? 'Unpin from dashboard' : 'Pin to dashboard'}
            className="p-1.5 rounded transition-colors"
            style={{
              color: isPinned ? 'var(--accent)' : 'var(--text-muted)',
              background: isPinned
                ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                : 'transparent',
              border: '1px solid var(--border)',
            }}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
          <Link
            href={`/series/${series.id}`}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="View series"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-4 text-xs flex-wrap"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>Units: {series.units_short}</span>
        <span>Updated: {formatDate(series.last_updated.split(' ')[0])}</span>
        <span>
          {series.observation_start} → {series.observation_end}
        </span>
        {series.popularity > 0 && (
          <span className="ml-auto">Popularity: {series.popularity}/100</span>
        )}
      </div>
    </div>
  );
}
