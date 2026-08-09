'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Map as MapIcon, RefreshCw } from 'lucide-react';
import {
  getRegionalData,
  type CensusFrequency,
  type CensusIndicator,
  type StateGdp,
} from '@/lib/regional';
import { QueryError } from '@/components/QueryError';

type SortKey = 'name' | 'changeOnQuarter' | 'changeOnYear';

function formatMonth(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Quarterly Census series are stamped on the first month of their quarter. */
function formatPeriod(date: string, frequency: CensusFrequency): string {
  if (frequency !== 'quarterly') return formatMonth(date);
  const parsed = new Date(`${date}T00:00:00Z`);
  const quarter = Math.floor(parsed.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${parsed.getUTCFullYear()}`;
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  const color =
    value > 0 ? 'var(--green)' : value < 0 ? 'var(--red)' : 'var(--text-muted)';
  return (
    <span style={{ color }}>
      {value > 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

function MissingKeyNotice({
  name,
  variable,
  href,
}: {
  name: string;
  variable: string;
  href: string;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      role="status"
      style={{
        background: 'color-mix(in srgb, var(--blue) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
        color: 'var(--text-muted)',
      }}
    >
      {name} data is not configured. Set the <code>{variable}</code> environment
      variable with a free key from{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium hover:underline"
        style={{ color: 'var(--accent)' }}
      >
        {new URL(href).hostname}
      </a>
      .
    </div>
  );
}

export default function RegionalPage() {
  const [sortKey, setSortKey] = useState<SortKey>('changeOnYear');
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['regional'],
    queryFn: ({ signal }) => getRegionalData(signal),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const sortedStates = useMemo((): StateGdp[] => {
    const states = [...(data?.stateGdp?.states ?? [])];
    if (sortKey === 'name') {
      return states.sort((left, right) => left.name.localeCompare(right.name));
    }
    return states.sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return rightValue - leftValue;
    });
  }, [data?.stateGdp?.states, sortKey]);

  // The Census set spans four themes, so cards are grouped rather than listed
  // flat. Group order follows the order indicators arrive in.
  const indicatorGroups = useMemo((): [string, CensusIndicator[]][] => {
    const groups = new Map<string, CensusIndicator[]>();
    for (const indicator of data?.indicators ?? []) {
      const existing = groups.get(indicator.group);
      if (existing) existing.push(indicator);
      else groups.set(indicator.group, [indicator]);
    }
    return [...groups];
  }, [data?.indicators]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <MapIcon className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Regional &amp; Business Activity
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            State-level GDP from the Bureau of Economic Analysis, with the full
            set of Census Bureau economic indicator time series covering trade,
            manufacturing, housing, construction and government finance.
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
              : 'Regional data could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      )}

      {data && !data.beaConfigured && (
        <MissingKeyNotice
          name="State GDP"
          variable="BEA_API_KEY"
          href="https://apps.bea.gov/API/signup/"
        />
      )}
      {data && !data.censusConfigured && (
        <MissingKeyNotice
          name="Census indicator"
          variable="CENSUS_API_KEY"
          href="https://api.census.gov/data/key_signup.html"
        />
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {isFetching ? 'Refreshing regional data.' : 'Regional data updated.'}
      </span>

      {isLoading && (
        <div
          className="h-96 rounded-xl animate-pulse"
          style={{ background: 'var(--surface-2)' }}
          aria-hidden="true"
        />
      )}

      {data && indicatorGroups.length > 0 && (
        <section aria-label="Census economic indicators" className="flex flex-col gap-6">
          {indicatorGroups.map(([group, indicators]) => (
            <div key={group}>
              <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
                {group}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {indicators.map((indicator) => (
                  <article
                    key={indicator.id}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <h3
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {indicator.label}
                    </h3>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: 'var(--text)' }}
                    >
                      {indicator.latest.value.toLocaleString('en-US')}
                      <span
                        className="text-sm font-normal ml-1"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {indicator.unit}
                      </span>
                    </p>
                    <div
                      className="flex items-center gap-3 mt-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>
                        {indicator.frequency === 'quarterly' ? '1q' : '1m'}{' '}
                        <ChangeCell value={indicator.changeOnMonth} />
                      </span>
                      <span>
                        1y <ChangeCell value={indicator.changeOnYear} />
                      </span>
                      <time dateTime={indicator.latest.date} className="ml-auto">
                        {formatPeriod(indicator.latest.date, indicator.frequency)}
                      </time>
                    </div>
                    <p
                      className="text-xs mt-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {indicator.note}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {data?.stateGdp && sortedStates.length > 0 && (
        <section aria-label="Real GDP by state">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              Real GDP by state — {data.stateGdp.period}
            </h2>
            <label className="text-xs flex items-center gap-2">
              <span style={{ color: 'var(--text-muted)' }}>Sort by</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="px-2 py-1 rounded-md text-xs"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <option value="changeOnYear">Year-on-year growth</option>
                <option value="changeOnQuarter">Quarter-on-quarter growth</option>
                <option value="name">State name</option>
              </select>
            </label>
          </div>

          <div
            className="rounded-xl overflow-x-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">
                Real GDP by state for {data.stateGdp.period}, with growth rates
              </caption>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th
                    scope="col"
                    className="text-left font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    State
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5 whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Real GDP
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    QoQ
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    YoY
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((state) => (
                  <tr
                    key={state.fips}
                    style={{
                      background: 'var(--surface)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <th
                      scope="row"
                      className="text-left px-4 py-2 font-normal"
                      style={{ color: 'var(--text)' }}
                    >
                      {state.name}
                    </th>
                    <td
                      className="text-right px-4 py-2 tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {state.value.toLocaleString('en-US', {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums">
                      <ChangeCell value={state.changeOnQuarter} />
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums">
                      <ChangeCell value={state.changeOnYear} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.stateGdp.unit && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Values in {data.stateGdp.unit.toLowerCase()}.
            </p>
          )}
        </section>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Data from the{' '}
        <a
          href="https://apps.bea.gov/API/signup/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Bureau of Economic Analysis
        </a>
        {' '}and the{' '}
        <a
          href="https://www.census.gov/data/developers/data-sets/economic-indicators.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          U.S. Census Bureau
        </a>
        . Neither agency endorses this site or its analysis.
      </p>
    </div>
  );
}
