import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    { status: 'live' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
