import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: true, uptime: process.uptime() }, { status: 200 });
}
