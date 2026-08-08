import { NextRequest, NextResponse } from 'next/server';
import {
  ENERGY_ROUTES,
  findComparison,
  groupEiaRows,
  percentChange,
  type EnergyResponse,
  type EnergySeries,
} from '@/lib/energy';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
} from '@/lib/upstream';

const EIA_BASE = 'https://api.eia.gov/v2';
const CACHE_SECONDS = 60 * 60;
const MAX_EIA_BYTES = 4 * 1024 * 1024;
/** Roughly two years of daily rows for two series, enough for a year-ago comparison. */
const ROW_LIMIT = 1_100;

type EnergyRoute = (typeof ENERGY_ROUTES)[number];

async function fetchEnergyRoute(
  definition: EnergyRoute,
  apiKey: string,
  signal: AbortSignal,
): Promise<EnergySeries[]> {
  const url = new URL(`${EIA_BASE}/${definition.route}/data/`);
  url.searchParams.set('frequency', definition.frequency);
  url.searchParams.append('data[]', 'value');
  for (const series of definition.series) {
    url.searchParams.append('facets[series][]', series.id);
  }
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', String(ROW_LIMIT));
  // Injected last and never logged — fetchUpstream records the operation name
  // rather than the URL, so the key stays out of telemetry.
  url.searchParams.set('api_key', apiKey);

  const upstream = await fetchUpstream(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  }, {
    service: 'eia',
    operation: definition.operation,
    timeoutMs: 15_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, MAX_EIA_BYTES);
  let grouped: Map<string, { date: string; value: number }[]>;
  try {
    grouped = groupEiaRows(data);
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }

  const series: EnergySeries[] = [];
  for (const definitionSeries of definition.series) {
    const observations = grouped.get(definitionSeries.id);
    const latest = observations?.at(-1);
    if (!observations || !latest) continue;

    series.push({
      id: definitionSeries.id,
      label: definitionSeries.label,
      unit: definitionSeries.unit,
      category: definitionSeries.category,
      latest,
      changeOnWeek: percentChange(latest, findComparison(observations, 7)),
      changeOnYear: percentChange(latest, findComparison(observations, 365)),
      observations,
    });
  }

  if (series.length === 0) {
    logInvalidPayload(upstream);
    throw new Error('upstream returned no recognised series');
  }
  logUpstreamSuccess(upstream);
  return series;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    // Energy prices are an optional enhancement, so an unconfigured deployment
    // renders an explanatory empty state instead of a hard error.
    return NextResponse.json(
      {
        series: [],
        updatedAt: new Date().toISOString(),
        partial: false,
        configured: false,
      } satisfies EnergyResponse,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const results = await Promise.allSettled(
    ENERGY_ROUTES.map((definition) =>
      fetchEnergyRoute(definition, apiKey, request.signal),
    ),
  );

  if (results.every((result) => result.status === 'rejected')) {
    return NextResponse.json(
      { error: 'Unable to contact the EIA energy price service.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const response: EnergyResponse = {
    series: results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
    updatedAt: new Date().toISOString(),
    partial: results.some((result) => result.status === 'rejected'),
    configured: true,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': response.partial
        ? 'no-store'
        : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
