'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useTheme } from '@/components/layout/Providers';
import type { FredObservation } from '@/lib/fred';

ChartJS.register(
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
);

interface Props {
  observations: FredObservation[];
  title: string;
  units: string;
  color?: string;
}

export function SeriesChart({ observations, title, units, color = '#10b981' }: Props) {
  const { dark } = useTheme();

  const gridColor  = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
  const tickColor  = dark ? '#94a3b8' : '#64748b';
  const tooltipBg  = dark ? '#1e293b' : '#ffffff';
  const tooltipBdr = dark ? '#334155' : '#e2e8f0';
  const tooltipTxt = dark ? '#f1f5f9' : '#0f172a';
  const tooltipMut = dark ? '#94a3b8' : '#64748b';

  const points = observations
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ x: o.date, y: parseFloat(o.value) }));

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 rounded-xl text-sm"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        No data available for the selected range.
      </div>
    );
  }

  const rgba = color + '1a';

  return (
    <Line
      data={{
        datasets: [
          {
            label: title,
            data: points,
            borderColor: color,
            backgroundColor: rgba,
            borderWidth: 2,
            pointRadius: points.length > 500 ? 0 : 2,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBdr,
            borderWidth: 1,
            titleColor: tooltipTxt,
            bodyColor: tooltipMut,
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${(ctx.parsed.y ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${units}`,
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'MMM d, yyyy' },
            grid: { color: gridColor },
            ticks: { color: tickColor, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              callback: (v) =>
                typeof v === 'number'
                  ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
                  : v,
            },
          },
        },
      }}
    />
  );
}
