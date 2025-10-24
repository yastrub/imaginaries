import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth';
import { query } from '@/server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const res = await query(`SELECT purpose, provider_key, model_key, updated_at FROM ai_defaults ORDER BY purpose ASC`);
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.ai.defaults] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch defaults' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { purpose, provider_key, model_key } = body || {};
    if (!purpose || !provider_key) {
      return NextResponse.json({ error: 'purpose and provider_key are required' }, { status: 400 });
    }

    const up = await query(
      `INSERT INTO ai_defaults(purpose, provider_key, model_key, updated_at)
       VALUES ($1,$2,$3, NOW())
       ON CONFLICT (purpose)
       DO UPDATE SET provider_key = EXCLUDED.provider_key, model_key = EXCLUDED.model_key, updated_at = NOW()
       RETURNING purpose, provider_key, model_key, updated_at`,
      [purpose, provider_key, model_key ?? null]
    );
    return NextResponse.json(up.rows[0]);
  } catch (e:any) {
    console.error('[admin.ai.defaults] POST error', e);
    return NextResponse.json({ error: 'Failed to upsert default' }, { status: 500 });
  }
}
