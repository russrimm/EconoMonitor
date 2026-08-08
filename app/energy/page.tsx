'use client';

import { useQuery } from '@tanstack/react-query';
import { Fuel, RefreshCw } from 'lucide-react';
import {
  getEnergyPrices,
  type EnergySeries,
} from '@/lib/energy';
import { SparklineChart } from '@/components/dashboard/SparklineChart';
import { QueryError } from '@/components/QueryError';

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function ChangeBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;

  const rising = value > 0;
  const color = rising ? 'var(--red)' : value < 0 ? 'var(--green)' : 'var(--text-muted)';
  return (
    <span style={{ color }}>
      {label} {rising ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

function EnergyCard({ series }: { series: EnergySeries }) {
  // Rising energy prices are unwelcome for consumers, so the trend colour is
  // inverted relative to a normal "up is good" metric card.
  const color = (series.changeOnYear ?? 0) > 0 ? '#ef4444' : '#22c55e';

  return (
    <article
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {series.label}
        </h3>
        <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
          {series.latest.value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 3,
          })}
          <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
            {series.unit}
          </span>
        </p>
      </div>

      <div className="h-14 -mx-1">
        <SparklineChart
          observations={series.observations.map((observation) => ({
            date: observation.date,
            value: String(observation.value),
          }))}
          color={color}
          label={series.label}
        />
      </div>

      <div
        className="flex items-center gap-3 flex-wrap text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChangeBadge label="1w" value={series.changeOnWeek} />
        <ChangeBadge label="1y" value={series.changeOnYear} />
        <time dateTime={series.latest.date} className="ml-auto">
          {formatDate(series.latest.date)}
        </time>
      </div>
    </article>
  );
}

export default function EnergyPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['energy-prices'],
    queryFn: ({ signal }) => getEnergyPrices(signal),
    staleTime: 30 * 60 * 1000,
  });

  const categories = [...new Set(data?.series.map((series) => series.category) ?? [])];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Fuel className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Energy Prices
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Retail fuel, crude oil, and natural gas prices from the U.S. Energy
            Information Administration.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <QueryError
          message={
            error instanceof Error
              ? error.message
              : 'Energy prices could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      )}

      {data && !data.configured && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          role="status"
          style={{
            background: 'color-mix(in srgb, var(--blue) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
            color: 'var(--text-muted)',
          }}
        >
          Energy prices are not configured. Set the <code>EIA_API_KEY</code>{' '}
          environment variable with a free key from{' '}
          <a
            href="https://www.eia.gov/opendata/register.php"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            eia.gov/opendata
          </a>
          .
        </div>
      )}

      {data?.partial && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          role="status"
          style={{
            background: 'color-mix(in srgb, var(--blue) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
            color: 'var(--text-muted)',
          }}
        >
          Some energy series are temporarily unavailable.
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {isFetching ? 'Refreshing energy prices.' : 'Energy prices updated.'}
      </span>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-44 rounded-xl animate-pulse"
              style={{ background: 'var(--surface-2)' }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {categories.map((category) => (
        <section key={category} aria-label={category}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.series
              .filter((series) => series.category === category)
              .map((series) => (
                <EnergyCard key={series.id} series={series} />
              ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Data from the{' '}
        <a
          href="https://www.eia.gov/opendata/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          U.S. Energy Information Administration
        </a>
        . Retail fuel prices are surveyed weekly; crude and natural gas spot
        prices are published each business day.
      </p>
    </div>
  );
}
