// ─── Anomaly detection ────────────────────────────────────────────────────────
// Robust z-score (median + MAD) of the latest period-over-period change against
// the trailing window of changes. Used to highlight unusual prints on the
// dashboard without any server round-trip or AI call.

import type { FredObservation } from './fred';

export type AnomalySeverity = 'normal' | 'mild' | 'strong' | 'extreme';

export interface AnomalyResult {
  severity: AnomalySeverity;
  /** Robust z-score of the latest change. Sign preserved (negative = unusually large drop). */
  zScore: number;
  /** Latest period-over-period change (absolute, in series units). */
  change: number;
  /** The latest change as a fraction of the trailing median absolute change. */
  ratio: number;
  /** Number of trailing observations used to build the reference distribution. */
  windowSize: number;
}

const WINDOW = 60; // trailing observations used for the reference distribution
const MIN_WINDOW = 12; // below this we don't have enough history to judge

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Score the latest observation as an anomaly relative to its own recent history.
 * Returns `null` when there isn't enough data to make a meaningful judgement.
 */
export function detectAnomaly(observations: FredObservation[]): AnomalyResult | null {
  const values = observations
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => parseFloat(o.value))
    .filter((v) => !isNaN(v));

  if (values.length < MIN_WINDOW + 1) return null;

  // Period-over-period changes (absolute, not percentage — works for rates and levels alike).
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i] - values[i - 1]);
  }
  if (changes.length < MIN_WINDOW) return null;

  const latestChange = changes[changes.length - 1];
  // Reference window excludes the latest change so it doesn't bias its own score.
  const window = changes.slice(
    Math.max(0, changes.length - 1 - WINDOW),
    changes.length - 1,
  );
  if (window.length < MIN_WINDOW) return null;

  const med = median(window);
  const absDevs = window.map((c) => Math.abs(c - med));
  const mad = median(absDevs);

  // 1.4826 makes MAD a consistent estimator of stddev for normal data.
  // Floor avoids divide-by-zero on flat windows (rates pinned at 0, etc.).
  const scale = Math.max(mad * 1.4826, Number.EPSILON);
  const z = (latestChange - med) / scale;

  // Ratio expressed against typical magnitude of change.
  const typical = Math.max(median(absDevs), Number.EPSILON);
  const ratio = (latestChange - med) / typical;

  const absZ = Math.abs(z);
  let severity: AnomalySeverity;
  if (absZ >= 5) severity = 'extreme';
  else if (absZ >= 3) severity = 'strong';
  else if (absZ >= 2) severity = 'mild';
  else severity = 'normal';

  return {
    severity,
    zScore: z,
    change: latestChange,
    ratio,
    windowSize: window.length,
  };
}

/** Short, plain-English label for a card badge. */
export function anomalyLabel(result: AnomalyResult): string {
  const direction = result.change >= 0 ? 'jump' : 'drop';
  switch (result.severity) {
    case 'extreme':
      return `Extreme ${direction}`;
    case 'strong':
      return `Unusual ${direction}`;
    case 'mild':
      return `Notable ${direction}`;
    default:
      return 'In-range';
  }
}

/** Tooltip text with magnitude context. */
export function anomalyTooltip(result: AnomalyResult): string {
  const x = Math.abs(result.ratio).toFixed(1);
  return (
    `Latest change is ~${x}× the typical move over the prior ${result.windowSize} periods ` +
    `(robust z = ${result.zScore.toFixed(1)}).`
  );
}

/**
 * Find the dates with the largest absolute period-over-period changes.
 * Used by the causal explainer to suggest "interesting" dates to ask about.
 */
export function topMovers(
  observations: FredObservation[],
  count = 5,
): { date: string; change: number }[] {
  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  const moves: { date: string; change: number }[] = [];
  for (let i = 1; i < valid.length; i++) {
    const a = parseFloat(valid[i - 1].value);
    const b = parseFloat(valid[i].value);
    if (isNaN(a) || isNaN(b)) continue;
    moves.push({ date: valid[i].date, change: b - a });
  }
  moves.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return moves.slice(0, count);
}
