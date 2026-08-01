'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useTheme } from '@/components/layout/Providers';
import { CHART_COLORS } from '@/lib/utils';
import type { FredObservation } from '@/lib/fred';

ChartJS.register(
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement,
  Tooltip, Legend,
);

export interface CompareDataset {
  seriesId: string;
  label: string;
  units: string;
  observations: FredObservation[];
}

interface Props {
  datasets: CompareDataset[];
  /**
   * When set, every series is drawn against a single Y-axis carrying this
   * label. Used by the normalization modes, where the series no longer carry
   * meaningful individual units.
   */
  sharedAxisLabel?: string | null;
  /**
   * Value to emphasise with a highlighted gridline (e.g. 100 for an indexed
   * chart, 0 for percent-change or z-score).
   */
  baseline?: number | null;
}

export function CompareChart({ datasets, sharedAxisLabel = null, baseline = null }: Props) {
  const { dark } = useTheme();

  const gridColor  = dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
  const baselineColor = dark ? 'rgba(148,163,184,0.55)' : 'rgba(15,23,42,0.35)';
  const tickColor  = dark ? '#94a3b8' : '#64748b';
  const legendColor = dark ? '#94a3b8' : '#64748b';
  const tooltipBg  = dark ? '#1e293b' : '#ffffff';
  const tooltipBdr = dark ? '#334155' : '#e2e8f0';
  const tooltipTxt = dark ? '#f1f5f9' : '#0f172a';
  const tooltipMut = dark ? '#94a3b8' : '#64748b';
  if (datasets.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 rounded-xl text-sm"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        Add series using the search box above to compare them.
      </div>
    );
  }

  const shared = sharedAxisLabel !== null;

  // Give every native unit group its own labelled axis.
  const unitGroups: string[] = [];
  datasets.forEach((d) => {
    if (!unitGroups.includes(d.units)) unitGroups.push(d.units);
  });

  const chartDatasets = datasets.map((d, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const points = d.observations
      .filter((o) => o.value !== '.' && o.value !== '')
      .map((o) => ({ x: o.date, y: parseFloat(o.value) }));

    const unitIndex = unitGroups.indexOf(d.units);
    const axisId = shared || unitIndex === 0 ? 'y' : `y${unitIndex}`;

    return {
      label: `${d.seriesId} — ${d.label}`,
      data: points,
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: points.length > 500 ? 0 : 2,
      pointHoverRadius: 4,
      tension: 0.2,
      yAxisID: axisId,
    };
  });

  const primaryAxisLabel = shared ? sharedAxisLabel : unitGroups[0] ?? '';

  const scales: Record<string, object> = {
    x: {
      type: 'time',
      time: { tooltipFormat: 'MMM d, yyyy' },
      grid: { color: gridColor },
      ticks: { color: tickColor, maxTicksLimit: 10 },
    },
    y: {
      position: 'left',
      title: {
        display: !!primaryAxisLabel,
        text: primaryAxisLabel,
        color: tickColor,
        font: { size: 11 },
      },
      grid: {
        color: (ctx: { tick?: { value: number } }) =>
          baseline !== null && ctx.tick?.value === baseline
            ? baselineColor
            : gridColor,
      },
      ticks: {
        color: tickColor,
        callback: (v: unknown) =>
          typeof v === 'number'
            ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : v,
      },
    },
  };

  if (!shared && unitGroups.length > 1) {
    unitGroups.slice(1).forEach((unit, index) => {
      const axisIndex = index + 1;
      scales[`y${axisIndex}`] = {
      position: axisIndex % 2 === 1 ? 'right' : 'left',
      title: {
        display: true,
        text: unit,
        color: tickColor,
        font: { size: 11 },
      },
      grid: { drawOnChartArea: false },
      ticks: {
        color: tickColor,
        callback: (v: unknown) =>
          typeof v === 'number'
            ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : v,
      },
    };
    });
  }

  return (
    <Line
      role="img"
      aria-label={`Comparison chart for ${datasets.map((dataset) => dataset.label).join(', ')}`}
      data={{ datasets: chartDatasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: legendColor,
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
              label: (context) => {
                const dataset = datasets[context.datasetIndex];
                const value = context.parsed.y ?? 0;
                const unit = sharedAxisLabel ?? dataset.units;
                return `${dataset.seriesId}: ${value.toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })}${unit ? ` ${unit}` : ''}`;
              },
            },
          },
        },
        scales,
      }}
    />
  );
}
