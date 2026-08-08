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
const MAX_BEA_BYTES = 8 * 1024 * 1024;
const MAX_CENSUS_BYTES = 4 * 1024 * 1024;

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
  url.searchParams.set('get', 'cell_value,time_slot_id,category_code,data_type_code,seasonally_adj');
  url.searchParams.set('time', 'from 2015');
  url.searchParams.set('category_code', definition.categoryCode);
  url.searchParams.set('data_type_code', definition.dataTypeCode);
  url.searchParams.set('seasonally_adj', 'yes');
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

export async function GET(request: NextRequest) {
  const beaKey = process.env.BEA_API_KEY;
  const censusKey = process.env.CENSUS_API_KEY;

  const [gdpResult, ...indicatorResults] = await Promise.allSettled([
    beaKey
      ? fetchStateGdp(beaKey, request.signal)
      : Promise.reject(new Error('BEA_API_KEY is not configured')),
    ...CENSUS_INDICATORS.map((definition) =>
      censusKey
        ? fetchCensusIndicator(definition, censusKey, request.signal)
        : Promise.reject(new Error('CENSUS_API_KEY is not configured')),
    ),
  ]);

  const indicators = indicatorResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value as CensusIndicator] : [],
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

  const partial =
    (Boolean(beaKey) && !stateGdp) ||
    (Boolean(censusKey) && indicators.length < CENSUS_INDICATORS.length);

  const response: RegionalResponse = {
    stateGdp: stateGdp
      ? { ...stateGdp, states: stateGdp.states }
      : null,
    indicators,
    updatedAt: new Date().toISOString(),
    partial,
    beaConfigured: Boolean(beaKey),
    censusConfigured: Boolean(censusKey),
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': partial
        ? 'no-store'
        : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
