import { NextRequest, NextResponse } from 'next/server';
import {
  hasAcceptableQueryLength,
  isAllowedFredPath,
  validateFredQuery,
} from '@/lib/apiProxy';
import {
  fetchUpstream,
  logInvalidPayload,
  logUpstreamSuccess,
  readLimitedJson,
} from '@/lib/upstream';
import { validateFredPayload } from '@/lib/upstreamSchemas';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FRED_API_KEY environment variable is not configured.' },
      { status: 500 },
    );
  }

  const { path } = await params;
  const fredPath = path.join('/');
  if (!isAllowedFredPath(fredPath)) {
    return NextResponse.json(
      { error: 'Unsupported FRED API path.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!hasAcceptableQueryLength(request.nextUrl.search)) {
    return NextResponse.json(
      { error: 'Query string is too long.' },
      { status: 414, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const queryError = validateFredQuery(fredPath, request.nextUrl.searchParams);
  if (queryError) {
    return NextResponse.json(
      { error: queryError },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Build upstream FRED URL
  const fredUrl = new URL(`${FRED_BASE}/${fredPath}`);

  // Forward all incoming query params (strip api_key for hygiene)
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'api_key') {
      fredUrl.searchParams.set(key, value);
    }
  });

  // Inject API key server-side — never reaches the browser
  fredUrl.searchParams.set('api_key', apiKey);
  fredUrl.searchParams.set('file_type', 'json');

  try {
    const upstream = await fetchUpstream(fredUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: request.signal,
    }, {
      service: 'fred',
      operation: fredPath,
      timeoutMs: 15_000,
      cachePolicy: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `FRED API returned ${upstream.status}` },
        { status: upstream.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const maximumBytes =
      fredPath === 'series/observations' ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    const data = await readLimitedJson(upstream, maximumBytes);
    if (!validateFredPayload(fredPath, data)) {
      logInvalidPayload(upstream);
      return NextResponse.json(
        { error: 'FRED API returned malformed data. Try again later.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    logUpstreamSuccess(upstream);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to contact the FRED API. Try again later.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
