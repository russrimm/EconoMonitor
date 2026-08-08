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
import { TREASURY_MATURITIES, type YieldCurveSnapshot } from '@/lib/rates';

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Tooltip, Legend,
);

export interface YieldCurveChartProps {
  latest: YieldCurveSnapshot;
  monthAgo: YieldCurveSnapshot | null;
  yearAgo: YieldCurveSnapshot | null;
}

const CURVE_STYLES = [
  { color: '#2563eb', width: 2.5, dash: [] as number[] },
  { color: '#f59e0b', width: 2, dash: [6, 4] },
  { color: '#94a3b8', width: 2, dash: [2, 3] },
];

function formatCurveDate(date: string): string {
  // The date is a plain calendar day, so it is rendered as UTC to keep the
  // label identical to the Treasury publication date in every time zone.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function YieldCurveChart({
  latest,
  monthAgo,
  yearAgo,
}: YieldCurveChartProps) {
  const { dark } = useTheme();

  const gridColor = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
  const tickColor = dark ? '#94a3b8' : '#64748b';
  const tooltipBg = dark ? '#1e293b' : '#ffffff';
  const tooltipBdr = dark ? '#334155' : '#e2e8f0';
  const tooltipTxt = dark ? '#f1f5f9' : '#0f172a';
  const tooltipMut = dark ? '#94a3b8' : '#64748b';

  // Every curve shares one categorical axis so the maturities line up even when
  // an older snapshot is missing a tenor that was not issued at the time.
  const labels = TREASURY_MATURITIES.map((maturity) => maturity.label);

  const snapshots = [
    { snapshot: latest, name: 'Latest' },
    { snapshot: monthAgo, name: 'One month ago' },
    { snapshot: yearAgo, name: 'One year ago' },
  ].filter(
    (entry): entry is { snapshot: YieldCurveSnapshot; name: string } =>
      entry.snapshot !== null,
  );

  const datasets = snapshots.map((entry, index) => {
    const style = CURVE_STYLES[index % CURVE_STYLES.length];
    const byLabel = new Map(
      entry.snapshot.points.map((point) => [point.label, point.percent]),
    );
    return {
      label: `${entry.name} — ${formatCurveDate(entry.snapshot.date)}`,
      data: labels.map((label) => byLabel.get(label) ?? null),
      borderColor: style.color,
      backgroundColor: style.color,
      borderWidth: style.width,
      borderDash: style.dash,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.25,
      spanGaps: true,
    };
  });

  return (
    <Line
      role="img"
      aria-label={`Treasury par yield curve for ${formatCurveDate(latest.date)}, compared with one month and one year earlier`}
      data={{ labels, datasets }}
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
                  ? `${context.dataset.label}: not issued`
                  : `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Maturity',
              color: tickColor,
              font: { size: 11 },
            },
            grid: { color: gridColor },
            ticks: { color: tickColor },
          },
          y: {
            title: {
              display: true,
              text: 'Yield (%)',
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
