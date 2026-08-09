import {
  readBoundedResponseJson,
  withDeadline,
} from './responseBody.ts';

/**
 * Treasury publishes each maturity as its own `<d:BC_*>` element. The order of
 * this list is the order the curve is drawn in, so it must stay ascending by
 * `months`.
 */
export const TREASURY_MATURITIES: readonly {
  tag: string;
  label: string;
  months: number;
}[] = [
  { tag: 'BC_1MONTH', label: '1M', months: 1 },
  { tag: 'BC_1_5MONTH', label: '1.5M', months: 1.5 },
  { tag: 'BC_2MONTH', label: '2M', months: 2 },
  { tag: 'BC_3MONTH', label: '3M', months: 3 },
  { tag: 'BC_4MONTH', label: '4M', months: 4 },
  { tag: 'BC_6MONTH', label: '6M', months: 6 },
  { tag: 'BC_1YEAR', label: '1Y', months: 12 },
  { tag: 'BC_2YEAR', label: '2Y', months: 24 },
  { tag: 'BC_3YEAR', label: '3Y', months: 36 },
  { tag: 'BC_5YEAR', label: '5Y', months: 60 },
  { tag: 'BC_7YEAR', label: '7Y', months: 84 },
  { tag: 'BC_10YEAR', label: '10Y', months: 120 },
  { tag: 'BC_20YEAR', label: '20Y', months: 240 },
  { tag: 'BC_30YEAR', label: '30Y', months: 360 },
];

export const REFERENCE_RATE_LABELS: Record<string, string> = {
  EFFR: 'Effective Federal Funds Rate',
  OBFR: 'Overnight Bank Funding Rate',
  SOFR: 'Secured Overnight Financing Rate',
  BGCR: 'Broad General Collateral Rate',
  TGCR: 'Tri-Party General Collateral Rate',
};

/** Display order for the reference-rate table — unsecured first, then secured. */
export const REFERENCE_RATE_ORDER = ['EFFR', 'OBFR', 'SOFR', 'BGCR', 'TGCR'];

export interface YieldCurvePoint {
  label: string;
  months: number;
  percent: number;
}

export interface YieldCurveSnapshot {
  date: string;
  points: YieldCurvePoint[];
}

export interface YieldSpread {
  label: string;
  shortLabel: string;
  longLabel: string;
  basisPoints: number;
}

export interface ReferenceRate {
  type: string;
  label: string;
  effectiveDate: string;
  percent: number;
  volumeInBillions: number | null;
  targetRateFrom: number | null;
  targetRateTo: number | null;
  /**
   * The New York Fed publishes the transaction-volume distribution behind each
   * rate. The 1st–99th band shows how dispersed trading was, which a single
   * headline rate hides.
   */
  percentile1: number | null;
  percentile25: number | null;
  percentile75: number | null;
  percentile99: number | null;
  /** `"R"` when the observation has been revised since first publication. */
  revised: boolean;
}

export interface ReferenceRateHistoryPoint {
  effectiveDate: string;
  percent: number;
  percentile1: number | null;
  percentile99: number | null;
  volumeInBillions: number | null;
}

export interface ReferenceRateHistory {
  type: string;
  label: string;
  points: ReferenceRateHistoryPoint[];
}

export interface SofrAverages {
  effectiveDate: string;
  average30day: number | null;
  average90day: number | null;
  average180day: number | null;
  index: number | null;
}

export interface RatesResponse {
  curve: {
    latest: YieldCurveSnapshot;
    monthAgo: YieldCurveSnapshot | null;
    yearAgo: YieldCurveSnapshot | null;
    spreads: YieldSpread[];
  } | null;
  referenceRates: ReferenceRate[];
  referenceRateHistory: ReferenceRateHistory[];
  sofrAverages: SofrAverages | null;
  updatedAt: string;
  providers: string[];
  partial: boolean;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function extractProperty(entry: string, tag: string): string | null {
  const match = entry.match(
    new RegExp(`<d:${tag}\\b[^>]*>([\\s\\S]*?)</d:${tag}>`, 'i'),
  );
  return match ? decodeXmlEntities(match[1]) : null;
}

/**
 * Treasury stamps `NEW_DATE` as a naive local timestamp (`2026-08-07T00:00:00`)
 * with no zone, so it is read as a plain calendar date rather than parsed by
 * `Date`, which would shift it across a day boundary in western time zones.
 */
export function parseTreasuryDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?$/);
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parsePercent(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const numeric = Number(value);
  // Treasury par yields have never been negative, and anything above 100% is a
  // malformed feed rather than a real rate.
  if (!Number.isFinite(numeric) || numeric < -50 || numeric > 100) return null;
  return numeric;
}

export function parseYieldCurveXml(xml: string): YieldCurveSnapshot[] {
  if (!/<feed[\s>]/i.test(xml)) {
    throw new Error('upstream response was not an Atom feed');
  }

  const snapshots: YieldCurveSnapshot[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const entry = match[1];
    const rawDate = extractProperty(entry, 'NEW_DATE');
    const date = rawDate ? parseTreasuryDate(rawDate) : null;
    if (!date) continue;

    const points: YieldCurvePoint[] = [];
    for (const maturity of TREASURY_MATURITIES) {
      const percent = parsePercent(extractProperty(entry, maturity.tag));
      if (percent === null) continue;
      points.push({
        label: maturity.label,
        months: maturity.months,
        percent,
      });
    }
    // A day with fewer than two maturities cannot be drawn as a curve.
    if (points.length < 2) continue;
    snapshots.push({ date, points });
  }

  return snapshots.sort((left, right) => left.date.localeCompare(right.date));
}

export function findPoint(
  snapshot: YieldCurveSnapshot,
  label: string,
): YieldCurvePoint | null {
  return snapshot.points.find((point) => point.label === label) ?? null;
}

const SPREAD_DEFINITIONS: readonly {
  label: string;
  short: string;
  long: string;
}[] = [
  { label: '10Y − 2Y', short: '2Y', long: '10Y' },
  { label: '10Y − 3M', short: '3M', long: '10Y' },
  { label: '30Y − 5Y', short: '5Y', long: '30Y' },
];

export function calculateSpreads(snapshot: YieldCurveSnapshot): YieldSpread[] {
  const spreads: YieldSpread[] = [];
  for (const definition of SPREAD_DEFINITIONS) {
    const shortEnd = findPoint(snapshot, definition.short);
    const longEnd = findPoint(snapshot, definition.long);
    if (!shortEnd || !longEnd) continue;
    spreads.push({
      label: definition.label,
      shortLabel: definition.short,
      longLabel: definition.long,
      // Rates arrive as percentages to 2dp; rounding avoids float noise such as
      // 45.99999999999999 basis points.
      basisPoints: Math.round((longEnd.percent - shortEnd.percent) * 100),
    });
  }
  return spreads;
}

interface NewYorkFedRate {
  effectiveDate?: unknown;
  type?: unknown;
  percentRate?: unknown;
  volumeInBillions?: unknown;
  targetRateFrom?: unknown;
  targetRateTo?: unknown;
  percentPercentile1?: unknown;
  percentPercentile25?: unknown;
  percentPercentile75?: unknown;
  percentPercentile99?: unknown;
  revisionIndicator?: unknown;
  average30day?: unknown;
  average90day?: unknown;
  average180day?: unknown;
  index?: unknown;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The feed carries `""` for unrevised rows and `"R"` once a value is restated. */
function isRevised(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === 'R';
}

function toReferenceRate(rate: NewYorkFedRate): ReferenceRate | null {
  if (typeof rate.type !== 'string' || typeof rate.effectiveDate !== 'string') {
    return null;
  }

  const label = REFERENCE_RATE_LABELS[rate.type];
  const percent = optionalNumber(rate.percentRate);
  const effectiveDate = parseTreasuryDate(rate.effectiveDate);
  // SOFRAI carries compounded averages instead of a rate, so it is read by
  // parseSofrAverages rather than skipped silently here.
  if (!label || percent === null || !effectiveDate) return null;

  return {
    type: rate.type,
    label,
    effectiveDate,
    percent,
    volumeInBillions: optionalNumber(rate.volumeInBillions),
    targetRateFrom: optionalNumber(rate.targetRateFrom),
    targetRateTo: optionalNumber(rate.targetRateTo),
    percentile1: optionalNumber(rate.percentPercentile1),
    percentile25: optionalNumber(rate.percentPercentile25),
    percentile75: optionalNumber(rate.percentPercentile75),
    percentile99: optionalNumber(rate.percentPercentile99),
    revised: isRevised(rate.revisionIndicator),
  };
}

export function parseReferenceRates(payload: unknown): ReferenceRate[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as { refRates?: unknown }).refRates)
  ) {
    throw new Error('upstream response did not contain reference rates');
  }

  const rates: ReferenceRate[] = [];
  for (const entry of (payload as { refRates: unknown[] }).refRates) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rate = toReferenceRate(entry as NewYorkFedRate);
    if (rate) rates.push(rate);
  }

  return rates.sort(
    (left, right) =>
      REFERENCE_RATE_ORDER.indexOf(left.type) -
      REFERENCE_RATE_ORDER.indexOf(right.type),
  );
}

/**
 * Reshapes a multi-rate `search.json` window into one ascending series per rate
 * type. The feed returns newest first and interleaves every rate type, so rows
 * are bucketed by type and re-sorted rather than trusted in arrival order.
 */
export function parseReferenceRateHistory(
  payload: unknown,
): ReferenceRateHistory[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as { refRates?: unknown }).refRates)
  ) {
    throw new Error('upstream response did not contain reference rates');
  }

  const byType = new Map<string, ReferenceRateHistoryPoint[]>();
  for (const entry of (payload as { refRates: unknown[] }).refRates) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rate = toReferenceRate(entry as NewYorkFedRate);
    if (!rate) continue;

    const points = byType.get(rate.type) ?? [];
    points.push({
      effectiveDate: rate.effectiveDate,
      percent: rate.percent,
      percentile1: rate.percentile1,
      percentile99: rate.percentile99,
      volumeInBillions: rate.volumeInBillions,
    });
    byType.set(rate.type, points);
  }

  return [...byType]
    .map(([type, points]) => ({
      type,
      label: REFERENCE_RATE_LABELS[type] ?? type,
      points: points.sort((left, right) =>
        left.effectiveDate.localeCompare(right.effectiveDate),
      ),
    }))
    .sort(
      (left, right) =>
        REFERENCE_RATE_ORDER.indexOf(left.type) -
        REFERENCE_RATE_ORDER.indexOf(right.type),
    );
}

export function parseSofrAverages(payload: unknown): SofrAverages | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as { refRates?: unknown }).refRates)
  ) {
    return null;
  }

  for (const entry of (payload as { refRates: unknown[] }).refRates) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rate = entry as NewYorkFedRate;
    if (rate.type !== 'SOFRAI' || typeof rate.effectiveDate !== 'string') continue;

    const effectiveDate = parseTreasuryDate(rate.effectiveDate);
    if (!effectiveDate) continue;

    return {
      effectiveDate,
      average30day: optionalNumber(rate.average30day),
      average90day: optionalNumber(rate.average90day),
      average180day: optionalNumber(rate.average180day),
      index: optionalNumber(rate.index),
    };
  }
  return null;
}

/** Formats a UTC month as the `YYYYMM` value the Treasury feed expects. */
export function treasuryMonthParameter(date: Date, monthOffset = 0): string {
  const shifted = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1),
  );
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${shifted.getUTCFullYear()}${month}`;
}

function isYieldCurveSnapshot(value: unknown): value is YieldCurveSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Partial<YieldCurveSnapshot>;
  return (
    typeof snapshot.date === 'string' &&
    Array.isArray(snapshot.points) &&
    snapshot.points.length > 0 &&
    snapshot.points.every(
      (point) =>
        typeof point === 'object' &&
        point !== null &&
        typeof point.label === 'string' &&
        typeof point.months === 'number' &&
        typeof point.percent === 'number',
    )
  );
}

export function isRatesResponse(value: unknown): value is RatesResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RatesResponse>;

  if (candidate.curve !== null) {
    if (typeof candidate.curve !== 'object' || candidate.curve === null) {
      return false;
    }
    const { latest, monthAgo, yearAgo, spreads } = candidate.curve;
    if (!isYieldCurveSnapshot(latest)) return false;
    if (monthAgo !== null && !isYieldCurveSnapshot(monthAgo)) return false;
    if (yearAgo !== null && !isYieldCurveSnapshot(yearAgo)) return false;
    if (
      !Array.isArray(spreads) ||
      !spreads.every(
        (spread) =>
          typeof spread === 'object' &&
          spread !== null &&
          typeof spread.label === 'string' &&
          typeof spread.basisPoints === 'number',
      )
    ) {
      return false;
    }
  }

  return (
    Array.isArray(candidate.referenceRates) &&
    candidate.referenceRates.every(
      (rate) =>
        typeof rate === 'object' &&
        rate !== null &&
        typeof rate.type === 'string' &&
        typeof rate.label === 'string' &&
        typeof rate.effectiveDate === 'string' &&
        typeof rate.percent === 'number',
    ) &&
    Array.isArray(candidate.referenceRateHistory) &&
    candidate.referenceRateHistory.every(
      (series) =>
        typeof series === 'object' &&
        series !== null &&
        typeof series.type === 'string' &&
        Array.isArray(series.points) &&
        series.points.every(
          (point) =>
            typeof point === 'object' &&
            point !== null &&
            typeof point.effectiveDate === 'string' &&
            typeof point.percent === 'number',
        ),
    ) &&
    typeof candidate.updatedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Array.isArray(candidate.providers) &&
    candidate.providers.every((provider) => typeof provider === 'string') &&
    typeof candidate.partial === 'boolean'
  );
}

export async function getRates(signal?: AbortSignal): Promise<RatesResponse> {
  const response = await fetch('/api/rates', {
    signal: withDeadline(signal, 20_000),
  });
  const data = await readBoundedResponseJson(response, 2 * 1024 * 1024).catch(
    () => null,
  );

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Failed to load interest rate data.';
    throw new Error(message);
  }

  if (!isRatesResponse(data)) {
    throw new Error('The interest rate service returned malformed data.');
  }
  return data;
}
