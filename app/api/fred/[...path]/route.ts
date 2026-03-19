import { NextRequest, NextResponse } from 'next/server';

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
    const upstream = await fetch(fredUrl.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }, // Next.js data-cache: 5 minutes
    });

    if (!upstream.ok) {
      const body = await upstream.text();
      return NextResponse.json(
        { error: `FRED API returned ${upstream.status}`, detail: body },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[FRED proxy] fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to contact the FRED API. Try again later.' },
      { status: 502 },
    );
  }
}
