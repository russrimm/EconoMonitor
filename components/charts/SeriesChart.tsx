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
  type Plugin,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useTheme } from '@/components/layout/Providers';
import type { FredObservation } from '@/lib/fred';
import type { HistoricalEvent } from '@/lib/events';
import { CATEGORY_COLOR } from '@/lib/events';

ChartJS.register(
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
);

export interface SeriesChartProps {
  observations: FredObservation[];
  title: string;
  units: string;
  color?: string;
  /** Optional historical events to overlay as vertical lines / shaded periods. */
  events?: HistoricalEvent[];
}

// Custom Chart.js plugin: draws vertical lines + shaded ranges + small labels
// for each event. Reads events off chart.options.plugins.eventOverlay.
const eventOverlayPlugin: Plugin<'line'> = {
  id: 'eventOverlay',
  afterDatasetsDraw(chart) {
    type EventPluginOptions = {
      events?: HistoricalEvent[];
      dark?: boolean;
    };
    const allPluginOpts = (chart.options.plugins ?? {}) as Record<string, unknown>;
    const opts = (allPluginOpts.eventOverlay ?? {}) as EventPluginOptions;
    const events = opts.events;
    if (!events || events.length === 0) return;
    const dark = !!opts.dark;

    const xScale = chart.scales.x;
    const { ctx, chartArea } = chart;
    if (!xScale || !chartArea) return;

    ctx.save();

    for (const e of events) {
      const color = CATEGORY_COLOR[e.category];
      const startTs = new Date(e.date + 'T00:00:00').getTime();
      const endTs = e.endDate
        ? new Date(e.endDate + 'T00:00:00').getTime()
        : startTs;

      const xStart = xScale.getPixelForValue(startTs);
      const xEnd = xScale.getPixelForValue(endTs);

      // Skip if entirely outside the chart area.
      if (xEnd < chartArea.left || xStart > chartArea.right) continue;

      const clampedStart = Math.max(xStart, chartArea.left);
      const clampedEnd = Math.max(clampedStart + 1, Math.min(xEnd, chartArea.right));

      // Shade the period for ranged events.
      if (e.endDate) {
        ctx.fillStyle = color + '14'; // ~8% alpha
        ctx.fillRect(
          clampedStart,
          chartArea.top,
          clampedEnd - clampedStart,
          chartArea.bottom - chartArea.top,
        );
      }

      // Vertical line at the headline date.
      if (xStart >= chartArea.left && xStart <= chartArea.right) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xStart, chartArea.top);
        ctx.lineTo(xStart, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Tiny label just inside the top of the chart.
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        const labelX = xStart + 3;
        const labelY = chartArea.top + 2;
        const label = e.title;
        const metrics = ctx.measureText(label);
        const padding = 3;
        ctx.fillStyle = dark ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.85)';
        ctx.fillRect(
          labelX - padding,
          labelY - 1,
          metrics.width + padding * 2,
          12,
        );
        ctx.fillStyle = color;
        ctx.fillText(label, labelX, labelY);
      }
    }

    ctx.restore();
  },
};

ChartJS.register(eventOverlayPlugin);

export function SeriesChart({
  observations,
  title,
  units,
  color = '#10b981',
  events,
}: SeriesChartProps) {
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
      role="img"
      aria-label={`${title} time-series chart`}
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
          // Custom plugin reads its data from here.
          // @ts-expect-error custom plugin namespace not in built-in types
          eventOverlay: { events: events ?? [], dark },
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
