// ─── Date formatting ───────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

// ─── Value formatting ──────────────────────────────────────────────────────────

export function formatValue(value: string, units = ''): string {
  if (value === '.' || value === '') return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  const u = units.toLowerCase();

  if (u.includes('percent') || u.includes('%')) {
    return `${num.toFixed(2)}%`;
  }
  if (u.includes('trillion')) {
    return `$${(num).toFixed(3)}T`;
  }
  if (u.includes('billion')) {
    return `$${num.toFixed(1)}B`;
  }
  if (u.includes('million')) {
    return `$${num.toFixed(1)}M`;
  }
  if (u.includes('thousand')) {
    return `${num.toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
  }
  if (u.includes('dollar') || u.startsWith('$')) {
    return `$${num.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// ─── Export helpers ────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(
  seriesId: string,
  title: string,
  observations: { date: string; value: string }[],
) {
  const header = `Date,"${title} (${seriesId})"`;
  const rows = observations
    .filter((o) => o.value !== '.')
    .map((o) => `${o.date},${o.value}`);
  triggerDownload([header, ...rows].join('\n'), `${seriesId}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToJSON(
  seriesId: string,
  title: string,
  observations: { date: string; value: string }[],
) {
  const data = {
    series_id: seriesId,
    title,
    exported_at: new Date().toISOString(),
    observations: observations
      .filter((o) => o.value !== '.')
      .map((o) => ({ date: o.date, value: parseFloat(o.value) })),
  };
  triggerDownload(
    JSON.stringify(data, null, 2),
    `${seriesId}.json`,
    'application/json',
  );
}

// ─── Chart colors ──────────────────────────────────────────────────────────────

export const CHART_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
];
