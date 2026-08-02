import { NextResponse } from 'next/server';
import { getReadiness } from '@/lib/health';

export function GET() {
  const readiness = getReadiness(process.env);

  return NextResponse.json(readiness.body, {
    status: readiness.httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  });
}
