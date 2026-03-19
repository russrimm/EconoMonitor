// Shared types and utilities for the AI economic analysis feature.
// This module is imported by both the server-side API route and client-side components.

export interface AnalyzeDataset {
  seriesId: string;
  label: string;
  units: string;
  observations: { date: string; value: string }[];
}

/** Evenly-strided downsample — always includes first and last point. */
export function downsampleSeries(
  obs: { date: string; value: string }[],
  maxPoints = 60,
): { date: string; value: string }[] {
  const valid = obs.filter((o) => o.value !== '.' && o.value !== '');
  if (valid.length <= maxPoints) return valid;

  const result: { date: string; value: string }[] = [];
  const stride = (valid.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(valid[Math.round(i * stride)]);
  }
  return result;
}

function computeStats(obs: { date: string; value: string }[]) {
  const values = obs.map((o) => parseFloat(o.value)).filter((v) => !isNaN(v));
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const oneYearAgo = values[Math.max(0, values.length - 12)];
  const trend = latest - oneYearAgo;
  return { min, max, latest, trend, count: values.length };
}

export function buildSystemPrompt(): string {
  return `You are a senior macroeconomic analyst with deep expertise in Federal Reserve data, monetary policy, fiscal policy, business cycles, and financial markets. You are analyzing data from the FRED (Federal Reserve Economic Data) database.

Provide a structured, insightful analysis with exactly these section headers:

### Key Trends
Summarize the most significant directional movements in each series.

### Correlations & Relationships
Identify relationships between the series (leading/lagging indicators, inversions, co-movements). If only one series is provided, analyze its internal patterns and cyclicality.

### Economic Interpretation
Explain what this data signals about the current macroeconomic environment (inflation, growth, employment, credit conditions, etc.).

### Anomalies & Notable Events
Flag any unusual spikes, drops, structural breaks, or divergences that stand out.

### Current State
Synthesize a concise assessment of where things stand today based on the most recent data points.

Be precise with numbers and dates. Use professional but accessible language. Avoid excessive hedging.`;
}

export function buildUserPrompt(datasets: AnalyzeDataset[]): string {
  const parts: string[] = [];

  parts.push(`## Economic Data for Analysis\n`);
  parts.push(`Series count: ${datasets.length}\n`);

  for (const ds of datasets) {
    const sampled = downsampleSeries(ds.observations);
    const stats = computeStats(sampled);

    parts.push(`---`);
    parts.push(`**Series: ${ds.seriesId}** — ${ds.label}`);
    parts.push(`Units: ${ds.units}`);

    if (stats) {
      const trendStr = `${stats.trend >= 0 ? '+' : ''}${stats.trend.toFixed(2)}`;
      parts.push(
        `Stats: min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}, latest=${stats.latest.toFixed(2)}, 12-period change=${trendStr}, n=${stats.count}`,
      );
    }

    if (sampled.length > 0) {
      parts.push(`Period: ${sampled[0].date} → ${sampled[sampled.length - 1].date}`);
    }

    parts.push(`\nDate,Value`);
    for (const o of sampled) {
      parts.push(`${o.date},${o.value}`);
    }
    parts.push('');
  }

  parts.push(`\nPlease provide your structured analysis of this economic data.`);
  return parts.join('\n');
}
