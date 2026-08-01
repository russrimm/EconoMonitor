'use client';

import { useState } from 'react';
import { Table2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const MAX_POINTS_PER_SERIES = 100;

export interface ChartTableDataset {
  seriesId: string;
  label: string;
  units: string;
  observations: { date: string; value: string }[];
}

interface Props {
  title: string;
  datasets: ChartTableDataset[];
}

function formatTableValue(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString('en-US', { maximumFractionDigits: 6 })
    : value;
}

export function ChartDataTable({ title, datasets }: Props) {
  const [expanded, setExpanded] = useState(false);
  const totalValidPoints = datasets.reduce(
    (sum, dataset) =>
      sum +
      dataset.observations.filter(
        (observation) =>
          observation.value !== '.' && observation.value !== '',
      ).length,
    0,
  );
  const rows = expanded
    ? datasets.flatMap((dataset) =>
        dataset.observations
          .filter(
            (observation) =>
              observation.value !== '.' && observation.value !== '',
          )
          .slice(-MAX_POINTS_PER_SERIES)
          .reverse()
          .map((observation) => ({ dataset, observation })),
      )
    : [];
  const isTruncated = rows.length < totalValidPoints;

  return (
    <details
      className="rounded-lg"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      style={{ border: '1px solid var(--border)' }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        <Table2 className="h-4 w-4" aria-hidden="true" />
        View chart data table
      </summary>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isTruncated
              ? `Showing the latest ${MAX_POINTS_PER_SERIES} observations per series. Use Export for the full dataset.`
              : `Showing all ${rows.length.toLocaleString()} observations.`}
          </p>
          <div
            className="max-h-96 overflow-auto focus:outline-none focus:ring-2"
            role="region"
            aria-label={`${title} scrollable table`}
            tabIndex={0}
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0" style={{ background: 'var(--surface-2)' }}>
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium">
                    Series
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium">
                    Value
                  </th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium">
                    Units
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ dataset, observation }, index) => (
                  <tr
                    key={`${dataset.seriesId}-${observation.date}-${index}`}
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="whitespace-nowrap px-3 py-2">
                      <time dateTime={observation.date}>
                        {formatDate(observation.date)}
                      </time>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{dataset.seriesId}</span>
                      <span className="ml-2">{dataset.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                      {formatTableValue(observation.value)}
                    </td>
                    <td className="px-3 py-2">{dataset.units || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  );
}
