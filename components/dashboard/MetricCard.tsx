'use client';

import Link from 'next/link';
import { Pin, PinOff, TrendingDown, TrendingUp } from 'lucide-react';
import { useSeries, useObservations } from '@/hooks/useFredQuery';
import { formatValue } from '@/lib/utils';
import { SparklineChart } from './SparklineChart';

interface Props {
  seriesId: string;
  isPinned: boolean;
  onToggle: (id: string) => void;
}

export function MetricCard({ seriesId, isPinned, onToggle }: Props) {
  const { data: seriesMeta, isLoading: metaLoading } = useSeries(seriesId);
  const { data: obsData, isLoading: obsLoading } = useObservations(seriesId, '5y');

  const series = seriesMeta?.seriess?.[0];
  const observations = obsData?.observations ?? [];
  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  const latest = valid[valid.length - 1];
  const prev = valid[valid.length - 2];

  let pct: number | null = null;
  let up = true;
  if (latest && prev) {
    const l = parseFloat(latest.value);
    const p = parseFloat(prev.value);
    if (!isNaN(l) && !isNaN(p) && p !== 0) {
      pct = ((l - p) / Math.abs(p)) * 100;
      up = pct >= 0;
    }
  }

  const accentColor = up ? '#10b981' : '#ef4444';

  if (metaLoading || obsLoading) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col gap-3 animate-pulse"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-3 rounded w-2/3" style={{ background: 'var(--border)' }} />
        <div className="h-6 rounded w-1/3" style={{ background: 'var(--border)' }} />
        <div className="h-16 rounded" style={{ background: 'var(--border)' }} />
        <div className="h-3 rounded w-1/2" style={{ background: 'var(--border)' }} />
      </div>
    );
  }

  if (!series) return null;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-colors hover:border-emerald-500/50 group"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="text-xs font-mono uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            {seriesId}
          </span>
          <Link
            href={`/series/${seriesId}`}
            className="mt-0.5 block text-sm font-semibold leading-snug line-clamp-2 hover:underline"
            style={{ color: 'var(--text)' }}
          >
            {series.title}
          </Link>
        </div>
        <button
          onClick={() => onToggle(seriesId)}
          title={isPinned ? 'Unpin' : 'Pin to dashboard'}
          className="shrink-0 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
      </div>

      {/* Value + change */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {latest ? formatValue(latest.value, series.units) : '—'}
        </span>
        {pct !== null && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: accentColor }}
          >
            {up ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(pct).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-16 w-full">
        {valid.length > 1 && (
          <SparklineChart observations={valid} color={accentColor} />
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>
          {series.frequency_short} · {series.units_short}
        </span>
        {latest && <span>{latest.date}</span>}
      </div>
    </div>
  );
}
