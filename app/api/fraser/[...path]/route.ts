import { NextRequest, NextResponse } from 'next/server';

const FRASER_BASE = 'https://fraser.stlouisfed.org/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiKey = process.env.FRASER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FRASER_API_KEY environment variable is not configured.' },
      { status: 500 },
    );
  }

  const { path } = await params;
  const fraserPath = path.join('/');

  const fraserUrl = new URL(`${FRASER_BASE}/${fraserPath}`);

  // Forward all incoming query params
  request.nextUrl.searchParams.forEach((value, key) => {
    fraserUrl.searchParams.set(key, value);
  });

  // Always request JSON
  fraserUrl.searchParams.set('format', 'json');

  try {
    const upstream = await fetch(fraserUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey, // FRASER auth is header-based, not a query param
      },
      next: { revalidate: 3600 }, // Archival content rarely changes — 1-hour cache
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: `FRASER API responded with ${upstream.status}`, detail: text },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach FRASER API', detail: String(err) },
      { status: 502 },
    );
  }
}
