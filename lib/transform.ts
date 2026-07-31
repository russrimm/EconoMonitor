// ─── Client-side normalization ────────────────────────────────────────────────
// FRED transformations (see `units` in lib/fred.ts) are applied server-side and
// change what a series *measures*. Normalization is a purely visual rescaling
// applied to whatever is already on screen, so that series with wildly different
// magnitudes and units can share a single Y-axis.

import type { FredObservation } from './fred';

export type NormalizeMode = 'none' | 'index100' | 'pctFromStart' | 'zscore';

export interface NormalizeOption {
  value: NormalizeMode;
  label: string;
  description: string;
  /** Shared Y-axis label when this mode is active. `null` = keep native units. */
  axisLabel: string | null;
}

export const NORMALIZE_MODES: NormalizeOption[] = [
  {
    value: 'none',
    label: 'Native units',
    description: 'Plot each series in its own units, using up to two Y-axes.',
    axisLabel: null,
  },
  {
    value: 'index100',
    label: 'Index (start = 100)',
    description: 'Rebase every series so its first visible observation equals 100 — the standard way to compare growth across different units.',
    axisLabel: 'Index (start = 100)',
  },
  {
    value: 'pctFromStart',
    label: '% change from start',
    description: 'Show each series as a percent change from its first visible observation.',
    axisLabel: '% change from start',
  },
  {
    value: 'zscore',
    label: 'Z-score',
    description: 'Standardise each series to zero mean and unit standard deviation over the visible window.',
    axisLabel: 'Standard deviations from mean',
  },
];

export const NORMALIZE_MAP: Record<NormalizeMode, NormalizeOption> =
  Object.fromEntries(NORMALIZE_MODES.map((m) => [m.value, m])) as Record<
    NormalizeMode,
    NormalizeOption
  >;

/** Y-axis / tooltip units for a normalized series. */
export function normalizedUnits(nativeUnits: string, mode: NormalizeMode): string {
  return NORMALIZE_MAP[mode]?.axisLabel ?? nativeUnits;
}

const EPSILON = 1e-9;

function parse(observations: FredObservation[]) {
  return observations
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ obs: o, value: parseFloat(o.value) }))
    .filter((p) => !isNaN(p.value));
}

function rescale(
  observations: FredObservation[],
  fn: (value: number) => number,
): FredObservation[] {
  return parse(observations).map(({ obs, value }) => ({
    ...obs,
    value: String(fn(value)),
  }));
}

/**
 * Rescale a series for display. Returns observations with recomputed `value`
 * strings so charts, tooltips, exports and the AI panels all stay consistent.
 *
 * Ratio-based modes need a non-zero base. The first visible observation is
 * preferred; if it is (near) zero — which happens legitimately for spreads like
 * T10Y2Y — we fall back to the first observation with a usable magnitude. When
 * no such point exists the series is returned untouched rather than silently
 * producing infinities.
 */
export function applyNormalization(
  observations: FredObservation[],
  mode: NormalizeMode,
): FredObservation[] {
  if (mode === 'none') return observations;

  const points = parse(observations);
  if (points.length === 0) return observations;

  if (mode === 'zscore') {
    const values = points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    if (sd < EPSILON) return rescale(observations, () => 0);
    return rescale(observations, (v) => (v - mean) / sd);
  }

  const base = points.find((p) => Math.abs(p.value) >= EPSILON)?.value;
  if (base === undefined) return observations;

  if (mode === 'index100') return rescale(observations, (v) => (v / base) * 100);
  return rescale(observations, (v) => (v / base - 1) * 100);
}

/** True when the mode forces every series onto one shared Y-axis. */
export function isSharedAxis(mode: NormalizeMode): boolean {
  return mode !== 'none';
}
