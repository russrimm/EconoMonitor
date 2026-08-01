'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  Pin,
  PinOff,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useSeries, useObservations } from '@/hooks/useFredQuery';
import { formatDate, formatValue } from '@/lib/utils';
import { detectAnomaly, anomalyLabel, anomalyTooltip } from '@/lib/anomaly';

const SparklineChart = dynamic(
  () => import('./SparklineChart').then((module) => module.SparklineChart),
  { ssr: false },
);

interface Props {
  seriesId: string;
  isPinned: boolean;
  onToggle: (id: string) => void;
}

export function MetricCard({ seriesId, isPinned, onToggle }: Props) {
  const metaQuery = useSeries(seriesId);
  const observationsQuery = useObservations(seriesId, '5y', {
    maxObservations: 80,
  });
  const { data: seriesMeta, isLoading: metaLoading } = metaQuery;
  const { data: obsData, isLoading: obsLoading } = observationsQuery;

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
    if (!isNaN(l) && !isNaN(p) && p > 0 && l >= 0) {
      pct = ((l - p) / p) * 100;
      up = pct >= 0;
    }
  }

  const accentColor = up ? '#10b981' : '#ef4444';

  // Robust anomaly detection on the most recent change vs trailing window.
  const anomaly = valid.length > 0 ? detectAnomaly(valid) : null;
  const showAnomalyBadge =
    anomaly !== null &&
    (anomaly.severity === 'mild' ||
      anomaly.severity === 'strong' ||
      anomaly.severity === 'extreme');
  const anomalyColor =
    anomaly?.severity === 'extreme'
      ? '#dc2626' // red-600
      : anomaly?.severity === 'strong'
        ? '#ea580c' // orange-600
        : '#d97706'; // amber-600

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

  if (metaQuery.isError || observationsQuery.isError) {
    return (
      <div
        className="rounded-xl p-4 flex min-h-44 flex-col justify-between gap-3"
        role="alert"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {series?.title ?? seriesId}
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>
            This indicator could not be loaded.
          </p>
        </div>
        <button
          onClick={() => {
            void metaQuery.refetch();
            void observationsQuery.refetch();
          }}
          className="flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
          style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
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
          <Link
            href={`/series/${seriesId}`}
            className="block text-sm font-semibold leading-snug line-clamp-2 hover:underline"
            style={{ color: 'var(--text)' }}
          >
            {series.title}
          </Link>
        </div>
        <button
          onClick={() => onToggle(seriesId)}
          title={isPinned ? 'Unpin' : 'Pin to dashboard'}
          aria-label={isPinned ? `Unpin ${series.title}` : `Pin ${series.title} to dashboard`}
          className="shrink-0 p-1 rounded transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          style={{ color: 'var(--text-muted)' }}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
      </div>

      {/* Value + change */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {latest ? formatValue(latest.value, series.units) : '—'}
        </span>
        {pct !== null && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: up ? 'var(--accent)' : 'var(--red)' }}
            title="Percent change from the prior observation"
          >
            {up ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(pct).toFixed(2)}%
          </span>
        )}
        {showAnomalyBadge && anomaly && (
          <span
            title={anomalyTooltip(anomaly)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{
              color: anomalyColor,
              background: `color-mix(in srgb, ${anomalyColor} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${anomalyColor} 40%, transparent)`,
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {anomalyLabel(anomaly)}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-16 w-full">
        {valid.length > 1 && (
          <SparklineChart observations={valid} color={accentColor} label={series.title} />
        )}
      </div>

      {/* Chart date range */}
      {valid.length > 1 && (() => {
        const chartStart = valid[Math.max(0, valid.length - 80)];
        const fmt = (d: string) =>
          new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return (
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text)' }}>
            <span>{fmt(chartStart.date)}</span>
            <span>{latest ? fmt(latest.date) : ''}</span>
          </div>
        );
      })()}

      {/* Footer */}
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>{latest ? `As of ${formatDate(latest.date)}` : 'No observations'}</span>
        <a
          href={`https://fred.stlouisfed.org/series/${encodeURIComponent(series.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          FRED
        </a>
      </div>
    </div>
  );
}
