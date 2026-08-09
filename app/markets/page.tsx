'use client';

import { useQuery } from '@tanstack/react-query';
import { Landmark, RefreshCw } from 'lucide-react';
import { getMarkets, type SomaHolding } from '@/lib/markets';
import { QueryError } from '@/components/QueryError';

/** SOMA and primary dealer figures arrive in dollars and millions respectively. */
function formatBillions(value: number | null, scale: number): string {
  if (value === null) return '—';
  return `$${(value / scale).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  })}B`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const SOMA_BREAKDOWN: readonly {
  key: keyof SomaHolding;
  label: string;
}[] = [
  { key: 'bills', label: 'Treasury bills' },
  { key: 'notesBonds', label: 'Notes and bonds' },
  { key: 'frn', label: 'Floating rate notes' },
  { key: 'tips', label: 'TIPS' },
  { key: 'mbs', label: 'Mortgage-backed securities' },
  { key: 'cmbs', label: 'Commercial MBS' },
  { key: 'agencies', label: 'Agency debt' },
];

export default function MarketsPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['markets'],
    queryFn: ({ signal }) => getMarkets(signal),
    staleTime: 60 * 60 * 1000,
  });

  const soma = data?.soma ?? null;
  const yearChange =
    soma?.yearAgo && soma.yearAgo.total !== 0
      ? ((soma.latest.total - soma.yearAgo.total) / soma.yearAgo.total) * 100
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Open Market Operations
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            System Open Market Account holdings, repo and reverse repo
            operations, and primary dealer positions from the New York Fed.
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
              : 'Open market operations data could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {isFetching
          ? 'Refreshing open market operations data.'
          : 'Open market operations data updated.'}
      </span>

      {isLoading && (
        <div
          className="h-96 rounded-xl animate-pulse"
          style={{ background: 'var(--surface-2)' }}
          aria-hidden="true"
        />
      )}

      {soma && (
        <section aria-label="SOMA holdings">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              SOMA holdings
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              As of {formatDate(soma.latest.asOfDate)}
            </span>
          </div>

          <div
            className="rounded-xl p-4 mb-3"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Total portfolio
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text)' }}>
              {formatBillions(soma.latest.total, 1_000_000_000)}
            </p>
            {yearChange !== null && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <span
                  style={{
                    color: yearChange > 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {yearChange > 0 ? '+' : ''}
                  {yearChange.toFixed(1)}%
                </span>{' '}
                versus a year earlier
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOMA_BREAKDOWN.map((item) => {
              const value = soma.latest[item.key];
              if (typeof value !== 'number') return null;
              return (
                <article
                  key={item.key}
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
                    {item.label}
                  </h3>
                  <p
                    className="text-xl font-bold mt-1 tabular-nums"
                    style={{ color: 'var(--text)' }}
                  >
                    {formatBillions(value, 1_000_000_000)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {data && data.primaryDealers.length > 0 && (
        <section aria-label="Primary dealer positions">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              Primary dealer positions
            </h2>
            {data.primaryDealerSeriesBreak && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Series break {data.primaryDealerSeriesBreak}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.primaryDealers.map((stat) => (
              <article
                key={stat.keyId}
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
                  {stat.label}
                </h3>
                <p
                  className="text-2xl font-bold mt-1 tabular-nums"
                  style={{
                    color: stat.value < 0 ? 'var(--red)' : 'var(--text)',
                  }}
                >
                  {formatBillions(stat.value, 1_000)}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {stat.note} As of {formatDate(stat.asOfDate)}.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {data && data.repoOperations.length > 0 && (
        <section aria-label="Repo and reverse repo operations">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
            Recent repo and reverse repo operations
          </h2>
          <div
            className="rounded-xl overflow-x-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">
                The most recent temporary open market operations
              </caption>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Date', 'Type', 'Term', 'Submitted', 'Accepted'].map(
                    (heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`font-medium px-4 py-2.5 whitespace-nowrap ${
                          index > 2 ? 'text-right' : 'text-left'
                        }`}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.repoOperations.map((operation) => (
                  <tr
                    key={operation.operationId}
                    style={{
                      background: 'var(--surface)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <th
                      scope="row"
                      className="text-left px-4 py-2 font-normal whitespace-nowrap"
                      style={{ color: 'var(--text)' }}
                    >
                      {formatDate(operation.operationDate)}
                    </th>
                    <td
                      className="px-4 py-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {operation.operationType}
                    </td>
                    <td
                      className="px-4 py-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {operation.term}
                    </td>
                    <td
                      className="text-right px-4 py-2 tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatBillions(operation.totalAmountSubmitted, 1_000_000_000)}
                    </td>
                    <td
                      className="text-right px-4 py-2 tabular-nums"
                      style={{ color: 'var(--text)' }}
                    >
                      {formatBillions(operation.totalAmountAccepted, 1_000_000_000)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Data from the{' '}
        <a
          href="https://markets.newyorkfed.org/static/docs/markets-api.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Federal Reserve Bank of New York
        </a>
        . The New York Fed does not endorse this site or its analysis.
      </p>
    </div>
  );
}
