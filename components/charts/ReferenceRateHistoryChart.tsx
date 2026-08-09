'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useTheme } from '@/components/layout/Providers';
import type { ReferenceRateHistory } from '@/lib/rates';

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Tooltip, Legend,
);

export interface ReferenceRateHistoryChartProps {
  series: ReferenceRateHistory[];
}

const SERIES_COLORS: Record<string, string> = {
  EFFR: '#2563eb',
  OBFR: '#7c3aed',
  SOFR: '#059669',
  BGCR: '#f59e0b',
  TGCR: '#dc2626',
};

function formatDate(date: string): string {
  // Publication dates are plain calendar days, so they are rendered as UTC to
  // keep labels identical to the New York Fed's in every time zone.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function ReferenceRateHistoryChart({
  series,
}: ReferenceRateHistoryChartProps) {
  const { dark } = useTheme();

  const gridColor = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
  const tickColor = dark ? '#94a3b8' : '#64748b';
  const tooltipBg = dark ? '#1e293b' : '#ffffff';
  const tooltipBdr = dark ? '#334155' : '#e2e8f0';
  const tooltipTxt = dark ? '#f1f5f9' : '#0f172a';
  const tooltipMut = dark ? '#94a3b8' : '#64748b';

  // Rate types publish on slightly different calendars, so the union of every
  // effective date becomes the shared axis and gaps are spanned.
  const labels = [
    ...new Set(
      series.flatMap((entry) => entry.points.map((point) => point.effectiveDate)),
    ),
  ].sort();

  const datasets = series.map((entry) => {
    const color = SERIES_COLORS[entry.type] ?? '#64748b';
    const byDate = new Map(
      entry.points.map((point) => [point.effectiveDate, point.percent]),
    );
    return {
      label: entry.type,
      data: labels.map((date) => byDate.get(date) ?? null),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.15,
      spanGaps: true,
    };
  });

  return (
    <Line
      role="img"
      aria-label={`Daily overnight reference rates from ${formatDate(labels[0] ?? '')} to ${formatDate(labels.at(-1) ?? '')}`}
      data={{ labels: labels.map(formatDate), datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: tickColor,
              boxWidth: 16,
              padding: 16,
              font: { size: 12 },
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBdr,
            borderWidth: 1,
            titleColor: tooltipTxt,
            bodyColor: tooltipMut,
            padding: 10,
            callbacks: {
              label: (context) =>
                context.parsed.y === null
                  ? `${context.dataset.label}: not published`
                  : `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              maxTicksLimit: 10,
              autoSkip: true,
            },
          },
          y: {
            title: {
              display: true,
              text: 'Rate (%)',
              color: tickColor,
              font: { size: 11 },
            },
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              callback: (value: string | number) =>
                typeof value === 'number' ? `${value.toFixed(2)}%` : value,
            },
          },
        },
      }}
    />
  );
}
