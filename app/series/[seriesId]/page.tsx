'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  GitCompare,
  Info,
  Pin,
  PinOff,
  RefreshCw,
} from 'lucide-react';
import { useSeries, useObservations } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { formatDate } from '@/lib/utils';
import { SeriesChart } from '@/components/charts/SeriesChart';
import { ExportButton } from '@/components/ExportButton';
import { InsightsPanel } from '@/components/ai/InsightsPanel';
import type { ObservationRange } from '@/lib/fred';

const RANGES: { label: string; value: ObservationRange }[] = [
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'Max', value: 'max' },
];

export default function SeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [range, setRange] = useState<ObservationRange>('5y');
  const [showNotes, setShowNotes] = useState(false);

  const { toggle, isPinned } = usePinnedSeries();
  const { data: seriesMeta, isLoading: metaLoading } = useSeries(seriesId);
  const { data: obsData, isLoading: obsLoading } = useObservations(seriesId, range);

  const series = seriesMeta?.seriess?.[0];
  const observations = obsData?.observations ?? [];
  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  const pinned = series ? isPinned(seriesId) : false;

  if (metaLoading) {
    return (
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-6 rounded w-1/3" style={{ background: 'var(--border)' }} />
        <div className="h-10 rounded w-2/3" style={{ background: 'var(--border)' }} />
        <div className="h-80 rounded-xl" style={{ background: 'var(--surface)' }} />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
        <p className="text-lg font-semibold">Series &ldquo;{seriesId}&rdquo; not found.</p>
        <Link
          href="/search"
          className="mt-4 inline-block text-sm underline"
          style={{ color: 'var(--accent)' }}
        >
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/search"
        className="flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Title + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className="text-sm font-mono px-2 py-0.5 rounded font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {series.id}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              {series.frequency}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              {series.seasonal_adjustment_short}
            </span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {series.title}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Units: {series.units}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => toggle(seriesId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: pinned
                ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                : 'var(--surface)',
              color: pinned ? 'var(--accent)' : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <Link
            href={`/compare?ids=${seriesId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </Link>
          {valid.length > 0 && (
            <ExportButton
              seriesId={series.id}
              title={series.title}
              observations={valid}
            />
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {[
          { label: 'Observation Start', value: series.observation_start },
          { label: 'Observation End', value: series.observation_end },
          { label: 'Last Updated', value: formatDate(series.last_updated.split(' ')[0]) },
          { label: 'Frequency', value: series.frequency },
          { label: 'Units', value: series.units_short },
          { label: 'Seasonal Adj.', value: series.seasonal_adjustment_short },
          { label: 'Popularity', value: `${series.popularity} / 100` },
          {
            label: 'Observations',
            value: obsLoading ? '…' : valid.length.toLocaleString(),
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p
              className="text-xs uppercase tracking-wide font-medium mb-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart section */}
      <div
        className="rounded-xl p-4 flex flex-col gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Range picker */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Date Range
            </span>
          </div>
          <div className="flex gap-1">
            {RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
                style={{
                  background:
                    range === value
                      ? 'var(--accent)'
                      : 'var(--surface-2)',
                  color: range === value ? '#fff' : 'var(--text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-80 relative">
          {obsLoading ? (
            <div
              className="h-full rounded-xl flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading observations…
            </div>
          ) : (
            <SeriesChart
              observations={valid}
              title={series.title}
              units={series.units_short}
            />
          )}
        </div>
      </div>

      {/* Notes */}
      {series.notes && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setShowNotes((p) => !p)}
            className="flex items-center gap-1.5 text-sm font-medium w-full"
            style={{ color: 'var(--text)' }}
          >
            <Info className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Series Notes
            <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              {showNotes ? 'Hide' : 'Show'}
            </span>
          </button>
          {showNotes && (
            <p
              className="mt-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {series.notes}
            </p>
          )}
        </div>
      )}

      {/* AI Insights */}
      {valid.length > 0 && (
        <InsightsPanel
          datasets={[{
            seriesId: series.id,
            label: series.title,
            units: series.units_short,
            observations: valid,
          }]}
        />
      )}
    </div>
  );
}
