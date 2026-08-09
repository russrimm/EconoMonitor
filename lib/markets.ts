import { readBoundedResponseJson, withDeadline } from './responseBody.ts';

/**
 * Open-market operations data published by the New York Fed. These feeds are
 * open — unlike FRED, EIA, BEA and Census they need no API key — so the page is
 * always populated when the upstream is reachable.
 */

export interface SomaHolding {
  asOfDate: string;
  bills: number | null;
  notesBonds: number | null;
  frn: number | null;
  tips: number | null;
  tipsInflationCompensation: number | null;
  mbs: number | null;
  cmbs: number | null;
  agencies: number | null;
  total: number;
}

export interface SomaSummary {
  latest: SomaHolding;
  /** Same week a year earlier, or the oldest point held if that far back. */
  yearAgo: SomaHolding | null;
  history: SomaHolding[];
}

export interface RepoOperationDetail {
  securityType: string;
  amountSubmitted: number | null;
  amountAccepted: number | null;
  percentOfferingRate: number | null;
  percentAwardRate: number | null;
  percentWeightedAverageRate: number | null;
}

export interface RepoOperation {
  operationId: string;
  operationType: string;
  operationMethod: string;
  operationDate: string;
  maturityDate: string | null;
  term: string;
  totalAmountSubmitted: number | null;
  totalAmountAccepted: number | null;
  acceptedCounterparties: number | null;
  details: RepoOperationDetail[];
}

export interface PrimaryDealerStat {
  keyId: string;
  label: string;
  note: string;
  asOfDate: string;
  /** Millions of dollars, as published. */
  value: number;
}

export interface MarketsResponse {
  soma: SomaSummary | null;
  repoOperations: RepoOperation[];
  primaryDealers: PrimaryDealerStat[];
  primaryDealerSeriesBreak: string | null;
  updatedAt: string;
  providers: string[];
  partial: boolean;
}

/**
 * Primary dealer series surfaced on the page. The `keyid` vocabulary is opaque
 * and the feed ships no labels, so descriptions come from the New York Fed's
 * published primary dealer statistics definitions.
 */
export const PRIMARY_DEALER_SERIES: readonly {
  keyId: string;
  label: string;
  note: string;
}[] = [
  {
    keyId: 'PDPOSGST-TOT',
    label: 'Net outright Treasury positions',
    note: 'Total U.S. Treasury securities excluding TIPS. Negative means net short.',
  },
  {
    keyId: 'PDPOSGS-B',
    label: 'Net outright bill positions',
    note: 'Treasury bills held outright by primary dealers.',
  },
  {
    keyId: 'PDPOSGS-BFRN',
    label: 'Net outright FRN positions',
    note: 'Treasury floating rate notes held outright by primary dealers.',
  },
  {
    keyId: 'PDTRGST-TOT',
    label: 'Treasury transaction volume',
    note: 'Average daily trading volume in U.S. Treasury securities excluding TIPS.',
  },
];

/** SOMA reports dollar amounts as strings, and empty for a not-yet-held class. */
function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
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

/**
 * `soma/summary.json` returns every weekly snapshot since 2003. Only a trailing
 * window is kept so the response the browser receives stays small.
 */
export function parseSomaSummary(
  payload: unknown,
  historyWeeks: number,
): SomaSummary {
  const rows = (payload as { soma?: { summary?: unknown } } | null)?.soma
    ?.summary;
  if (!Array.isArray(rows)) {
    throw new Error('upstream response did not contain a SOMA summary');
  }

  const holdings: SomaHolding[] = [];
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const asOfDate = parseIsoDate(row.asOfDate);
    const total = parseAmount(row.total);
    if (!asOfDate || total === null) continue;

    holdings.push({
      asOfDate,
      bills: parseAmount(row.bills),
      notesBonds: parseAmount(row.notesbonds),
      frn: parseAmount(row.frn),
      tips: parseAmount(row.tips),
      tipsInflationCompensation: parseAmount(row.tipsInflationCompensation),
      mbs: parseAmount(row.mbs),
      cmbs: parseAmount(row.cmbs),
      agencies: parseAmount(row.agencies),
      total,
    });
  }

  holdings.sort((left, right) => left.asOfDate.localeCompare(right.asOfDate));
  const latest = holdings.at(-1);
  if (!latest) {
    throw new Error('SOMA summary contained no usable rows');
  }

  // Reporting weeks do not land on the same calendar day each year, so the
  // comparison point is the last snapshot on or before the anniversary.
  const anniversary = new Date(`${latest.asOfDate}T00:00:00Z`);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() - 1);
  const anniversaryKey = anniversary.toISOString().slice(0, 10);
  const yearAgo =
    [...holdings]
      .reverse()
      .find((holding) => holding.asOfDate <= anniversaryKey) ?? null;

  return {
    latest,
    yearAgo,
    history: holdings.slice(-historyWeeks),
  };
}

export function parseRepoOperations(
  payload: unknown,
  limit: number,
): RepoOperation[] {
  const rows = (payload as { repo?: { operations?: unknown } } | null)?.repo
    ?.operations;
  if (!Array.isArray(rows)) {
    throw new Error('upstream response did not contain repo operations');
  }

  const operations: RepoOperation[] = [];
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const operationDate = parseIsoDate(row.operationDate);
    if (typeof row.operationId !== 'string' || !operationDate) continue;

    const rawDetails = Array.isArray(row.details) ? row.details : [];
    const details: RepoOperationDetail[] = [];
    for (const detailEntry of rawDetails) {
      if (typeof detailEntry !== 'object' || detailEntry === null) continue;
      const detail = detailEntry as Record<string, unknown>;
      if (typeof detail.securityType !== 'string') continue;
      details.push({
        securityType: detail.securityType,
        amountSubmitted: parseAmount(detail.amtSubmitted),
        amountAccepted: parseAmount(detail.amtAccepted),
        percentOfferingRate: parseAmount(detail.percentOfferingRate),
        percentAwardRate: parseAmount(detail.percentAwardRate),
        percentWeightedAverageRate: parseAmount(
          detail.percentWeightedAverageRate,
        ),
      });
    }

    operations.push({
      operationId: row.operationId,
      operationType:
        typeof row.operationType === 'string' ? row.operationType : 'Unknown',
      operationMethod:
        typeof row.operationMethod === 'string' ? row.operationMethod : '',
      operationDate,
      maturityDate: parseIsoDate(row.maturityDate),
      term: typeof row.term === 'string' ? row.term : '',
      totalAmountSubmitted: parseAmount(row.totalAmtSubmitted),
      totalAmountAccepted: parseAmount(row.totalAmtAccepted),
      acceptedCounterparties: parseAmount(row.acceptedCpty),
      details,
    });
  }

  // Newest first: the most recent operations are what a reader looks for.
  operations.sort((left, right) =>
    right.operationDate.localeCompare(left.operationDate),
  );
  return operations.slice(0, limit);
}

/**
 * The latest primary dealer release carries roughly 1,500 series. Only the
 * curated set is kept; `"*"` marks a value withheld for confidentiality and is
 * dropped rather than coerced to zero.
 */
export function parsePrimaryDealers(payload: unknown): PrimaryDealerStat[] {
  const rows = (payload as { pd?: { timeseries?: unknown } } | null)?.pd
    ?.timeseries;
  if (!Array.isArray(rows)) {
    throw new Error('upstream response did not contain primary dealer data');
  }

  const wanted = new Map(
    PRIMARY_DEALER_SERIES.map((series) => [series.keyId, series]),
  );
  const stats = new Map<string, PrimaryDealerStat>();

  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.keyid !== 'string') continue;
    const series = wanted.get(row.keyid);
    if (!series) continue;

    const asOfDate = parseIsoDate(row.asofdate);
    const value = parseAmount(row.value);
    if (!asOfDate || value === null) continue;

    const existing = stats.get(series.keyId);
    if (existing && existing.asOfDate >= asOfDate) continue;
    stats.set(series.keyId, { ...series, asOfDate, value });
  }

  return PRIMARY_DEALER_SERIES.flatMap((series) => {
    const stat = stats.get(series.keyId);
    return stat ? [stat] : [];
  });
}

/** Picks the series break covering today from `pd/list/seriesbreaks.json`. */
export function parseCurrentSeriesBreak(payload: unknown): string | null {
  const rows = (payload as { pd?: { seriesbreaks?: unknown } } | null)?.pd
    ?.seriesbreaks;
  if (!Array.isArray(rows)) return null;

  const today = new Date().toISOString().slice(0, 10);
  let fallback: string | null = null;
  let fallbackStart = '';

  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.seriesbreak !== 'string') continue;
    const start = parseIsoDate(row.startdate);
    const end = parseIsoDate(row.enddate);
    if (!start) continue;

    if (start <= today && (!end || end >= today)) return row.seriesbreak;
    // A clock skewed past the newest break still resolves to the latest one.
    if (start > fallbackStart) {
      fallbackStart = start;
      fallback = row.seriesbreak;
    }
  }
  return fallback;
}

export function isMarketsResponse(value: unknown): value is MarketsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<MarketsResponse>;

  if (candidate.soma !== null && candidate.soma !== undefined) {
    if (
      typeof candidate.soma !== 'object' ||
      typeof candidate.soma.latest !== 'object' ||
      candidate.soma.latest === null ||
      typeof candidate.soma.latest.asOfDate !== 'string' ||
      typeof candidate.soma.latest.total !== 'number' ||
      !Array.isArray(candidate.soma.history)
    ) {
      return false;
    }
  }

  return (
    Array.isArray(candidate.repoOperations) &&
    candidate.repoOperations.every(
      (operation) =>
        typeof operation === 'object' &&
        operation !== null &&
        typeof operation.operationId === 'string' &&
        typeof operation.operationDate === 'string',
    ) &&
    Array.isArray(candidate.primaryDealers) &&
    candidate.primaryDealers.every(
      (stat) =>
        typeof stat === 'object' &&
        stat !== null &&
        typeof stat.keyId === 'string' &&
        typeof stat.value === 'number' &&
        typeof stat.asOfDate === 'string',
    ) &&
    typeof candidate.updatedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.updatedAt)) &&
    Array.isArray(candidate.providers) &&
    typeof candidate.partial === 'boolean'
  );
}

export async function getMarkets(
  signal?: AbortSignal,
): Promise<MarketsResponse> {
  const response = await fetch('/api/markets', {
    signal: withDeadline(signal, 25_000),
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
        : 'Failed to load open market operations data.';
    throw new Error(message);
  }

  if (!isMarketsResponse(data)) {
    throw new Error('The open market operations service returned malformed data.');
  }
  return data;
}
