'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  GitCompare,
  History,
  Info,
  Pin,
  PinOff,
  RefreshCw,
} from 'lucide-react';
import { useSeries, useObservations } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { formatDate } from '@/lib/utils';
import type { SeriesChartProps } from '@/components/charts/SeriesChart';
import { ExportButton } from '@/components/ExportButton';
import { TransformControls } from '@/components/controls/TransformControls';
import { InsightsPanel } from '@/components/ai/InsightsPanel';
import { CausalExplainerPanel } from '@/components/ai/CausalExplainerPanel';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import {
  CATEGORY_COLOR,
  EVENTS,
  eventsInRange,
  fraserSearchUrl,
} from '@/lib/events';
import {
  aggregatableFrequencies,
  transformSuffix,
  transformedUnits,
  type FredAggregation,
  type FredFrequency,
  type FredUnits,
  type ObservationRange,
} from '@/lib/fred';

const RANGES: { label: string; value: ObservationRange }[] = [
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'Max', value: 'max' },
];

const SeriesChart = dynamic<SeriesChartProps>(
  () => import('@/components/charts/SeriesChart').then((module) => module.SeriesChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-64 items-center justify-center rounded-xl text-sm"
        role="status"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        Loading interactive chart…
      </div>
    ),
  },
);

export default function SeriesDetailPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [range, setRange] = useState<ObservationRange>('5y');
  const [showNotes, setShowNotes] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [units, setUnits] = useState<FredUnits>('lin');
  const [frequency, setFrequency] = useState<FredFrequency>('');
  const [aggregation, setAggregation] = useState<FredAggregation>('avg');

  const { toggle, isPinned } = usePinnedSeries();
  const metaQuery = useSeries(seriesId);
  const { data: seriesMeta, isLoading: metaLoading } = metaQuery;

  const nativeFrequencyShort = seriesMeta?.seriess?.[0]?.frequency_short ?? '';

  // A frequency picked for a previous series may not be legal for this one
  // (FRED can only aggregate downward), so validate before it reaches the API.
  const effectiveFrequency: FredFrequency =
    frequency &&
    aggregatableFrequencies(nativeFrequencyShort).some((f) => f.value === frequency)
      ? frequency
      : '';

  const observationsQuery = useObservations(seriesId, range, {
    units,
    frequency: effectiveFrequency,
    aggregation,
  });
  const { data: obsData, isLoading: obsLoading } = observationsQuery;

  const series = seriesMeta?.seriess?.[0];
  const observations = obsData?.observations ?? [];
  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  const pinned = series ? isPinned(seriesId) : false;

  // Units shown on the axis, tooltip and AI panels once a transform is applied.
  const displayUnits = transformedUnits(series?.units_short ?? '', units);
  const displayTitle = `${series?.title ?? seriesId}${transformSuffix(units)}`;

  // Events that fall within the visible chart range.
  const visibleEvents = useMemo(() => {
    if (valid.length === 0) return [];
    const start = valid[0].date;
    const end = valid[valid.length - 1].date;
    return eventsInRange(EVENTS, start, end);
  }, [valid]);

  if (metaLoading) {
    return (
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-6 rounded w-1/3" style={{ background: 'var(--border)' }} />
        <div className="h-10 rounded w-2/3" style={{ background: 'var(--border)' }} />
        <div className="h-80 rounded-xl" style={{ background: 'var(--surface)' }} />
      </div>
    );
  }

  if (metaQuery.isError) {
    return (
      <div className="py-20 text-center" role="alert">
        <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          Series details could not be loaded.
        </p>
        <button
          onClick={() => void metaQuery.refetch()}
          className="mt-4 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Try again
        </button>
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
            Units: {units === 'lin' ? series.units : displayUnits}
            {units !== 'lin' && (
              <span className="ml-1.5" style={{ opacity: 0.75 }}>
                (transformed from {series.units})
              </span>
            )}
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
              title={displayTitle}
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
          {
            label: 'Source',
            value: (
              <a
                href={`https://fred.stlouisfed.org/series/${encodeURIComponent(series.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                FRED
              </a>
            ),
          },
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
          <div className="flex items-center gap-2 flex-wrap">
            {visibleEvents.length > 0 && (
              <button
                onClick={() => setShowEvents((p) => !p)}
                title="Overlay historical economic events"
                aria-pressed={showEvents}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: showEvents
                    ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'var(--surface-2)',
                  color: showEvents ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${showEvents ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                }}
              >
                <History className="w-3.5 h-3.5" />
                Events ({visibleEvents.length})
              </button>
            )}
            <div className="flex gap-1">
              {RANGES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setRange(value)}
                  aria-pressed={range === value}
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
        </div>

        {/* Transformation controls */}
        <div
          className="flex items-center justify-between gap-3 flex-wrap pt-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <TransformControls
            units={units}
            onUnitsChange={setUnits}
            nativeFrequencyShort={series.frequency_short}
            frequency={effectiveFrequency}
            onFrequencyChange={setFrequency}
            aggregation={aggregation}
            onAggregationChange={setAggregation}
          />
          {units !== 'lin' && (
            <button
              onClick={() => {
                setUnits('lin');
                setFrequency('');
              }}
              className="text-xs font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              Reset to levels
            </button>
          )}
        </div>

        {/* Chart */}
        <div className="h-80 relative">
          {observationsQuery.isError ? (
            <div
              className="h-full rounded-xl flex flex-col items-center justify-center gap-3 text-sm"
              role="alert"
              style={{ background: 'var(--surface-2)', color: 'var(--red)' }}
            >
              Observations could not be loaded.
              <button
                onClick={() => void observationsQuery.refetch()}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                Try again
              </button>
            </div>
          ) : obsLoading ? (
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
              title={displayTitle}
              units={displayUnits}
              events={showEvents ? visibleEvents : []}
            />
          )}
        </div>
        {!obsLoading && !observationsQuery.isError && valid.length > 0 && (
          <ChartDataTable
            title={`${displayTitle} chart data`}
            datasets={[
              {
                seriesId: series.id,
                label: displayTitle,
                units: displayUnits,
                observations: valid,
              },
            ]}
          />
        )}
      </div>

      {/* Historical events list */}
      {showEvents && visibleEvents.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Events during this period
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              · click any event to search FRASER
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleEvents.map((e) => {
              const color = CATEGORY_COLOR[e.category];
              const dateLabel = e.endDate
                ? `${formatDate(e.date)} – ${formatDate(e.endDate)}`
                : formatDate(e.date);
              return (
                <li key={e.id}>
                  <a
                    href={fraserSearchUrl(e)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <span
                      className="mt-1 w-2 h-2 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>
                          {e.title}
                        </span>
                        <span
                          className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color,
                            background: `color-mix(in srgb, ${color} 14%, transparent)`,
                          }}
                        >
                          {e.category}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {dateLabel}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {e.summary}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 text-xs mt-1.5"
                        style={{ color: 'var(--accent)' }}
                      >
                        <BookOpen className="w-3 h-3" />
                        FRASER search
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
        <CausalExplainerPanel
          seriesId={series.id}
          label={displayTitle}
          units={displayUnits}
          observations={valid}
        />
      )}

      {valid.length > 0 && (
        <InsightsPanel
          datasets={[{
            seriesId: series.id,
            label: displayTitle,
            units: displayUnits,
            observations: valid,
          }]}
        />
      )}
    </div>
  );
}
