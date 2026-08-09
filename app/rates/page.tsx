'use client';

import { useQuery } from '@tanstack/react-query';
import { Landmark, Percent, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { getRates, type YieldSpread } from '@/lib/rates';
import { YieldCurveChart } from '@/components/charts/YieldCurveChart';
import { ReferenceRateHistoryChart } from '@/components/charts/ReferenceRateHistoryChart';
import { QueryError } from '@/components/QueryError';

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function SpreadCard({ spread }: { spread: YieldSpread }) {
  const inverted = spread.basisPoints < 0;
  const accent = inverted ? 'var(--red)' : 'var(--green)';
  const Icon = inverted ? TrendingDown : TrendingUp;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {spread.label}
        </span>
        <Icon className="w-4 h-4" aria-hidden="true" style={{ color: accent }} />
      </div>
      <p className="text-2xl font-bold mt-2" style={{ color: 'var(--text)' }}>
        {spread.basisPoints > 0 ? '+' : ''}
        {spread.basisPoints} bp
      </p>
      <p className="text-xs mt-1" style={{ color: accent }}>
        {inverted ? 'Inverted' : 'Positively sloped'}
      </p>
    </div>
  );
}

export default function RatesPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['rates'],
    queryFn: ({ signal }) => getRates(signal),
    staleTime: 15 * 60 * 1000,
  });

  const curve = data?.curve ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Percent className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Interest Rates
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            The Treasury par yield curve and the New York Fed&apos;s overnight
            reference rates, published each business day.
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
              : 'Interest rate data could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
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
          One rate provider is temporarily unavailable.
          {data.providers.length > 0 &&
            ` Showing data from ${data.providers.join(' and ')}.`}
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {isFetching ? 'Refreshing interest rates.' : 'Interest rates updated.'}
      </span>

      {isLoading && (
        <div
          className="h-96 rounded-xl animate-pulse"
          style={{ background: 'var(--surface-2)' }}
          aria-hidden="true"
        />
      )}

      {curve && (
        <>
          <section
            className="rounded-xl p-4"
            aria-busy={isFetching}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                Treasury par yield curve
              </h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                As of {formatDate(curve.latest.date)}
              </span>
            </div>
            <div className="h-96">
              <YieldCurveChart
                latest={curve.latest}
                monthAgo={curve.monthAgo}
                yearAgo={curve.yearAgo}
              />
            </div>
          </section>

          {curve.spreads.length > 0 && (
            <section aria-label="Key yield spreads">
              <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
                Key spreads
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {curve.spreads.map((spread) => (
                  <SpreadCard key={spread.label} spread={spread} />
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                A negative spread means shorter maturities yield more than longer
                ones. Inversion of the 10-year minus 2-year spread has preceded
                every US recession since 1970, though the lead time has varied
                widely.
              </p>
            </section>
          )}
        </>
      )}

      {data && data.referenceRates.length > 0 && (
        <section aria-label="Overnight reference rates">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              Overnight reference rates
            </h2>
          </div>
          <div
            className="rounded-xl overflow-x-auto"
            style={{ border: '1px solid var(--border)' }}
          >
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">
                New York Fed overnight reference rates with trading volumes
              </caption>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th
                    scope="col"
                    className="text-left font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Rate
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Percent
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5 whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    1st–99th pct
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5 whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Volume ($B)
                  </th>
                  <th
                    scope="col"
                    className="text-right font-medium px-4 py-2.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Effective
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.referenceRates.map((rate) => (
                  <tr
                    key={rate.type}
                    style={{
                      background: 'var(--surface)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <th
                      scope="row"
                      className="text-left px-4 py-2.5 font-normal"
                      style={{ color: 'var(--text)' }}
                    >
                      <span className="font-semibold">{rate.type}</span>
                      <span
                        className="block text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {rate.label}
                        {rate.targetRateFrom !== null &&
                          rate.targetRateTo !== null &&
                          ` · target ${rate.targetRateFrom.toFixed(2)}–${rate.targetRateTo.toFixed(2)}%`}
                      </span>
                    </th>
                    <td
                      className="text-right px-4 py-2.5 font-semibold tabular-nums"
                      style={{ color: 'var(--text)' }}
                    >
                      {rate.percent.toFixed(2)}%
                    </td>
                    <td
                      className="text-right px-4 py-2.5 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {rate.percentile1 === null || rate.percentile99 === null
                        ? '—'
                        : `${rate.percentile1.toFixed(2)}–${rate.percentile99.toFixed(2)}%`}
                      {rate.percentile25 !== null &&
                        rate.percentile75 !== null && (
                          <span
                            className="block text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            IQR {rate.percentile25.toFixed(2)}–
                            {rate.percentile75.toFixed(2)}%
                          </span>
                        )}
                    </td>
                    <td
                      className="text-right px-4 py-2.5 tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {rate.volumeInBillions === null
                        ? '—'
                        : rate.volumeInBillions.toLocaleString('en-US')}
                    </td>
                    <td
                      className="text-right px-4 py-2.5 whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <time dateTime={rate.effectiveDate}>
                        {formatDate(rate.effectiveDate)}
                      </time>
                      {rate.revised && (
                        <span
                          className="block text-xs"
                          style={{ color: 'var(--text-muted)' }}
                          title="Revised since first publication"
                        >
                          revised
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.sofrAverages && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Compounded SOFR averages as of{' '}
              {formatDate(data.sofrAverages.effectiveDate)}:{' '}
              {[
                ['30-day', data.sofrAverages.average30day],
                ['90-day', data.sofrAverages.average90day],
                ['180-day', data.sofrAverages.average180day],
              ]
                .filter(
                  (entry): entry is [string, number] => entry[1] !== null,
                )
                .map(([term, value]) => `${term} ${value.toFixed(3)}%`)
                .join(' · ')}
              .
            </p>
          )}
        </section>
      )}

      {data && data.referenceRateHistory.length > 0 && (
        <section aria-label="Reference rate history">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>
            Overnight reference rates — last 180 days
          </h2>
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="h-80">
              <ReferenceRateHistoryChart series={data.referenceRateHistory} />
            </div>
          </div>
        </section>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Yield curve data from the{' '}
        <a
          href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          U.S. Department of the Treasury
        </a>
        {' '}and reference rates from the{' '}
        <a
          href="https://www.newyorkfed.org/markets/reference-rates"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Federal Reserve Bank of New York
        </a>
        . Both are published each business day and are not real-time quotes.
      </p>
    </div>
  );
}
