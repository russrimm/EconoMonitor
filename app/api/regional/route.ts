import { NextRequest, NextResponse } from 'next/server';
import {
  buildCensusIndicator,
  CENSUS_INDICATORS,
  parseCensusTimeseries,
  parseStateGdp,
  type CensusIndicator,
  type RegionalResponse,
} from '@/lib/regional';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
} from '@/lib/upstream';

const BEA_BASE = 'https://apps.bea.gov/api/data';
const CENSUS_BASE = 'https://api.census.gov/data/timeseries/eits';
const CACHE_SECONDS = 6 * 60 * 60;
/** Shorter reuse window when a provider is missing, so retries stay cheap. */
const PARTIAL_CACHE_SECONDS = 15 * 60;
const MAX_BEA_BYTES = 8 * 1024 * 1024;
const MAX_CENSUS_BYTES = 4 * 1024 * 1024;
/** Quarterly datasets reach back further so a year-on-year change still exists. */
const CENSUS_START_YEAR = 2010;
const CENSUS_CONCURRENCY = 6;

async function fetchStateGdp(apiKey: string, signal: AbortSignal) {
  const url = new URL(BEA_BASE);
  url.searchParams.set('method', 'GetData');
  url.searchParams.set('datasetname', 'Regional');
  // Quarterly real GDP by state, all-industry total, chained dollars.
  url.searchParams.set('TableName', 'SQGDP9');
  url.searchParams.set('LineCode', '1');
  url.searchParams.set('GeoFips', 'STATE');
  url.searchParams.set('Year', 'LAST5');
  url.searchParams.set('ResultFormat', 'JSON');
  url.searchParams.set('UserID', apiKey);

  const upstream = await fetchUpstream(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  }, {
    service: 'bea',
    operation: 'regional/state-gdp',
    timeoutMs: 20_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, MAX_BEA_BYTES);
  try {
    const parsed = parseStateGdp(data);
    if (parsed.states.length === 0) {
      throw new Error('BEA returned no state observations');
    }
    logUpstreamSuccess(upstream);
    return parsed;
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }
}

async function fetchCensusIndicator(
  definition: (typeof CENSUS_INDICATORS)[number],
  apiKey: string,
  signal: AbortSignal,
): Promise<CensusIndicator> {
  const url = new URL(`${CENSUS_BASE}/${definition.dataset}`);
  // `qtax` names its variables in upper case; every other dataset uses lower
  // case, and requesting the wrong case is rejected outright.
  const name = (variable: string): string =>
    definition.uppercaseVariables ? variable.toUpperCase() : variable;

  // `geo_level_code` drives the national-only filter in parseCensusTimeseries;
  // `time_slot_id` is a required predicate on the residential datasets.
  url.searchParams.set(
    'get',
    [
      'cell_value',
      'geo_level_code',
      'time_slot_id',
      'category_code',
      'data_type_code',
      'seasonally_adj',
    ]
      .map(name)
      .join(','),
  );
  url.searchParams.set('time', `from ${CENSUS_START_YEAR}`);
  url.searchParams.set(name('category_code'), definition.categoryCode);
  url.searchParams.set(name('data_type_code'), definition.dataTypeCode);
  // Adjustment is not universal: `qfr`, `qpr` and `mhs2` publish no adjusted
  // series for these cells, and `vip`/`hv` carry it under separate codes.
  url.searchParams.set(name('seasonally_adj'), definition.seasonallyAdj);
  // `advm3`, `m3`, `bfs`, `mhs2` and `qtax` reject a request without a geography
  // predicate ("error: missing 'for' argument"); the rest accept it harmlessly,
  // so it is sent for every dataset rather than tracked per definition.
  url.searchParams.set('for', 'us:*');
  url.searchParams.set('key', apiKey);

  const upstream = await fetchUpstream(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  }, {
    service: 'census',
    operation: `eits/${definition.dataset}`,
    timeoutMs: 20_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, MAX_CENSUS_BYTES);
  try {
    const indicator = buildCensusIndicator(
      definition,
      parseCensusTimeseries(data),
    );
    if (!indicator) {
      throw new Error('Census returned no usable observations');
    }
    logUpstreamSuccess(upstream);
    return indicator;
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }
}

/**
 * Runs `task` over `items` a few at a time. The indicator list is long enough
 * that firing every request at once risks upstream throttling, and results stay
 * positional so a rejection maps back to its definition.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = {
          status: 'fulfilled',
          value: await task(items[index]),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export async function GET(request: NextRequest) {
  const beaKey = process.env.BEA_API_KEY;
  const censusKey = process.env.CENSUS_API_KEY;

  const [gdpResult, indicatorResults] = await Promise.all([
    beaKey
      ? fetchStateGdp(beaKey, request.signal).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          () => ({ status: 'rejected' as const, value: null }),
        )
      : Promise.resolve({ status: 'rejected' as const, value: null }),
    censusKey
      ? mapWithConcurrency(CENSUS_INDICATORS, CENSUS_CONCURRENCY, (definition) =>
          fetchCensusIndicator(definition, censusKey, request.signal),
        )
      : Promise.resolve(
          CENSUS_INDICATORS.map(
            () =>
              ({
                status: 'rejected',
                reason: new Error('CENSUS_API_KEY is not configured'),
              }) satisfies PromiseSettledResult<CensusIndicator>,
          ),
        ),
  ]);

  const indicators = indicatorResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const stateGdp = gdpResult.status === 'fulfilled' ? gdpResult.value : null;

  // A missing key is a configuration state, not an outage, so it is reported
  // through the `configured` flags rather than a 502.
  if (beaKey && censusKey && !stateGdp && indicators.length === 0) {
    return NextResponse.json(
      { error: 'Unable to contact the BEA and Census data services.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Discontinued datasets are expected to return nothing, so their absence is
  // not treated as a degraded response.
  const expectedIndicators = CENSUS_INDICATORS.filter(
    (definition) => !definition.optional,
  ).length;
  const requiredDelivered = indicatorResults.filter(
    (result, index) =>
      result.status === 'fulfilled' && !CENSUS_INDICATORS[index].optional,
  ).length;

  const partial =
    (Boolean(beaKey) && !stateGdp) ||
    (Boolean(censusKey) && requiredDelivered < expectedIndicators);

  const response: RegionalResponse = {
    stateGdp: stateGdp ? { ...stateGdp, states: stateGdp.states } : null,
    indicators,
    updatedAt: new Date().toISOString(),
    partial,
    beaConfigured: Boolean(beaKey),
    censusConfigured: Boolean(censusKey),
  };

  // Even a partial response is cached briefly: one flaky dataset out of the
  // full EITS set must not turn every page view into a fresh upstream fan-out.
  const maxAge = partial ? PARTIAL_CACHE_SECONDS : CACHE_SECONDS;
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=600`,
    },
  });
}
