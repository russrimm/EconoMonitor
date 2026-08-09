import { NextRequest, NextResponse } from 'next/server';
import {
  parseCurrentSeriesBreak,
  parsePrimaryDealers,
  parseRepoOperations,
  parseSomaSummary,
  type MarketsResponse,
  type PrimaryDealerStat,
  type RepoOperation,
  type SomaSummary,
} from '@/lib/markets';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
} from '@/lib/upstream';

const NEW_YORK_FED_BASE = 'https://markets.newyorkfed.org/api';
const CACHE_SECONDS = 60 * 60;
const PARTIAL_CACHE_SECONDS = 10 * 60;

/** `soma/summary.json` carries every weekly snapshot since 2003. */
const MAX_SOMA_BYTES = 4 * 1024 * 1024;
/** The latest primary dealer release is roughly 1,500 series. */
const MAX_PRIMARY_DEALER_BYTES = 2 * 1024 * 1024;
const MAX_SMALL_BYTES = 512 * 1024;

const SOMA_HISTORY_WEEKS = 104;
const REPO_OPERATION_LIMIT = 20;

/**
 * These government feeds reject some default runtime agents, and identifying
 * the caller is the etiquette they ask for.
 */
const USER_AGENT = 'EconoMonitor/1.0 (+https://github.com/russrimm/EconoMonitor)';

async function fetchNewYorkFed<T>(
  path: string,
  operation: string,
  maxBytes: number,
  parse: (payload: unknown) => T,
  signal: AbortSignal,
): Promise<T> {
  const upstream = await fetchUpstream(`${NEW_YORK_FED_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    cache: 'no-store',
    signal,
  }, {
    service: 'new_york_fed',
    operation,
    timeoutMs: 15_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, maxBytes);
  try {
    const parsed = parse(data);
    logUpstreamSuccess(upstream);
    return parsed;
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }
}

/**
 * Primary dealer figures are only comparable inside a series break, so the
 * current break is looked up before the values are requested.
 */
async function fetchPrimaryDealers(signal: AbortSignal): Promise<{
  seriesBreak: string;
  stats: PrimaryDealerStat[];
}> {
  const seriesBreak = await fetchNewYorkFed(
    '/pd/list/seriesbreaks.json',
    'primary-dealers/series-breaks',
    MAX_SMALL_BYTES,
    (payload) => {
      const value = parseCurrentSeriesBreak(payload);
      if (!value) throw new Error('no current primary dealer series break');
      return value;
    },
    signal,
  );

  const stats = await fetchNewYorkFed(
    `/pd/latest/${encodeURIComponent(seriesBreak)}.json`,
    'primary-dealers/latest',
    MAX_PRIMARY_DEALER_BYTES,
    (payload) => {
      const parsed = parsePrimaryDealers(payload);
      if (parsed.length === 0) {
        throw new Error('no recognised primary dealer series');
      }
      return parsed;
    },
    signal,
  );

  return { seriesBreak, stats };
}

export async function GET(request: NextRequest) {
  const [somaResult, repoResult, dealerResult] = await Promise.allSettled([
    fetchNewYorkFed(
      '/soma/summary.json',
      'soma/summary',
      MAX_SOMA_BYTES,
      (payload) => parseSomaSummary(payload, SOMA_HISTORY_WEEKS),
      request.signal,
    ),
    fetchNewYorkFed(
      `/rp/all/all/results/last/${REPO_OPERATION_LIMIT}.json`,
      'repo/results',
      MAX_SMALL_BYTES,
      (payload) => parseRepoOperations(payload, REPO_OPERATION_LIMIT),
      request.signal,
    ),
    fetchPrimaryDealers(request.signal),
  ]);

  if (
    somaResult.status === 'rejected' &&
    repoResult.status === 'rejected' &&
    dealerResult.status === 'rejected'
  ) {
    return NextResponse.json(
      { error: 'Unable to contact the New York Fed markets service.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const soma: SomaSummary | null =
    somaResult.status === 'fulfilled' ? somaResult.value : null;
  const repoOperations: RepoOperation[] =
    repoResult.status === 'fulfilled' ? repoResult.value : [];

  const partial =
    somaResult.status === 'rejected' ||
    repoResult.status === 'rejected' ||
    dealerResult.status === 'rejected';

  const response: MarketsResponse = {
    soma,
    repoOperations,
    primaryDealers:
      dealerResult.status === 'fulfilled' ? dealerResult.value.stats : [],
    primaryDealerSeriesBreak:
      dealerResult.status === 'fulfilled' ? dealerResult.value.seriesBreak : null,
    updatedAt: new Date().toISOString(),
    providers: ['New York Fed'],
    partial,
  };

  // Partial responses are still cached briefly so a single failing feed cannot
  // turn every page view into a fresh upstream fan-out.
  const maxAge = partial ? PARTIAL_CACHE_SECONDS : CACHE_SECONDS;
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=600`,
    },
  });
}
