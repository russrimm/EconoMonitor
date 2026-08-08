import { NextRequest, NextResponse } from 'next/server';
import {
  calculateSpreads,
  parseReferenceRates,
  parseSofrAverages,
  parseYieldCurveXml,
  treasuryMonthParameter,
  type RatesResponse,
  type ReferenceRate,
  type SofrAverages,
  type YieldCurveSnapshot,
} from '@/lib/rates';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
  readLimitedText,
} from '@/lib/upstream';

const TREASURY_YIELD_CURVE_XML =
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml';
const NEW_YORK_FED_RATES =
  'https://markets.newyorkfed.org/api/rates/all/latest.json';
const CACHE_SECONDS = 30 * 60;
const MAX_TREASURY_BYTES = 2 * 1024 * 1024;
const MAX_NEW_YORK_FED_BYTES = 256 * 1024;

/**
 * Both publishers reject some default runtime agents, and identifying the
 * caller is the etiquette these government feeds ask for.
 */
const USER_AGENT = 'EconoMonitor/1.0 (+https://github.com/russrimm/EconoMonitor)';

/**
 * Treasury serves one Atom feed per calendar month. `month` is always derived
 * from the server clock rather than the request, so no caller input reaches the
 * upstream URL.
 */
async function fetchYieldCurveMonth(
  month: string,
  operation: string,
  signal: AbortSignal,
): Promise<YieldCurveSnapshot[]> {
  const url = new URL(TREASURY_YIELD_CURVE_XML);
  url.searchParams.set('data', 'daily_treasury_yield_curve');
  url.searchParams.set('field_tdr_date_value_month', month);

  const upstream = await fetchUpstream(url, {
    headers: {
      Accept: 'application/xml, text/xml',
      'User-Agent': USER_AGENT,
    },
    cache: 'no-store',
    signal,
  }, {
    service: 'treasury',
    operation,
    timeoutMs: 10_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!/xml/i.test(contentType)) {
    logInvalidPayload(upstream);
    throw new Error('upstream response was not XML');
  }

  const xml = await readLimitedText(upstream, MAX_TREASURY_BYTES);
  try {
    const snapshots = parseYieldCurveXml(xml);
    logUpstreamSuccess(upstream);
    return snapshots;
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }
}

async function fetchYieldCurve(signal: AbortSignal): Promise<{
  latest: YieldCurveSnapshot;
  monthAgo: YieldCurveSnapshot | null;
  yearAgo: YieldCurveSnapshot | null;
}> {
  const now = new Date();
  // The current month is empty on the first business day, so the previous month
  // is always fetched too — it doubles as the one-month-ago baseline.
  const [currentMonth, previousMonth, yearAgoMonth] = await Promise.all([
    fetchYieldCurveMonth(treasuryMonthParameter(now), 'yield-curve/current', signal),
    fetchYieldCurveMonth(
      treasuryMonthParameter(now, -1),
      'yield-curve/previous',
      signal,
    ),
    fetchYieldCurveMonth(
      treasuryMonthParameter(now, -12),
      'yield-curve/year-ago',
      signal,
    ).catch(() => [] as YieldCurveSnapshot[]),
  ]);

  const recent = [...previousMonth, ...currentMonth];
  const latest = recent.at(-1);
  if (!latest) {
    throw new Error('Treasury feed contained no usable observations');
  }

  return {
    latest,
    monthAgo: previousMonth.at(-1) ?? null,
    yearAgo: yearAgoMonth.at(-1) ?? null,
  };
}

async function fetchReferenceRates(signal: AbortSignal): Promise<{
  rates: ReferenceRate[];
  sofrAverages: SofrAverages | null;
}> {
  const upstream = await fetchUpstream(NEW_YORK_FED_RATES, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    cache: 'no-store',
    signal,
  }, {
    service: 'new_york_fed',
    operation: 'reference-rates',
    timeoutMs: 10_000,
    cachePolicy: 'no-store',
  });

  if (!upstream.ok) {
    throw new Error(`upstream returned ${upstream.status}`);
  }

  const data = await readLimitedJson(upstream, MAX_NEW_YORK_FED_BYTES);
  try {
    const rates = parseReferenceRates(data);
    if (rates.length === 0) {
      throw new Error('upstream returned no recognised reference rates');
    }
    logUpstreamSuccess(upstream);
    return { rates, sofrAverages: parseSofrAverages(data) };
  } catch (error) {
    logInvalidPayload(upstream);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const [curveResult, ratesResult] = await Promise.allSettled([
    fetchYieldCurve(request.signal),
    fetchReferenceRates(request.signal),
  ]);

  if (curveResult.status === 'rejected' && ratesResult.status === 'rejected') {
    return NextResponse.json(
      { error: 'Unable to contact the Treasury and New York Fed rate services.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const curve =
    curveResult.status === 'fulfilled'
      ? {
          ...curveResult.value,
          spreads: calculateSpreads(curveResult.value.latest),
        }
      : null;

  const response: RatesResponse = {
    curve,
    referenceRates:
      ratesResult.status === 'fulfilled' ? ratesResult.value.rates : [],
    sofrAverages:
      ratesResult.status === 'fulfilled' ? ratesResult.value.sofrAverages : null,
    updatedAt: new Date().toISOString(),
    providers: [
      ...(curveResult.status === 'fulfilled' ? ['U.S. Treasury'] : []),
      ...(ratesResult.status === 'fulfilled' ? ['New York Fed'] : []),
    ],
    partial:
      curveResult.status === 'rejected' || ratesResult.status === 'rejected',
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': response.partial
        ? 'no-store'
        : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
