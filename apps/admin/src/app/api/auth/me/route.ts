import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/server/auth';

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ user, requiresConfirmation: !user.email_confirmed });
  } catch (e: any) {
    console.error('Admin me error:', e);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
