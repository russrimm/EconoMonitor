'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Filler);

interface Props {
  observations: { date: string; value: string }[];
  color: string;
}

export function SparklineChart({ observations, color }: Props) {
  const points = observations
    .filter((o) => o.value !== '.' && o.value !== '')
    .slice(-80)
    .map((o) => ({ x: o.date, y: parseFloat(o.value) }));

  if (points.length < 2) return null;

  const rgba = `${color}26`; // ~15% opacity fill

  return (
    <Line
      data={{
        datasets: [
          {
            data: points,
            borderColor: color,
            backgroundColor: rgba,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { type: 'time', display: false },
          y: { display: false },
        },
        elements: { line: { borderCapStyle: 'round' } },
      }}
    />
  );
}
