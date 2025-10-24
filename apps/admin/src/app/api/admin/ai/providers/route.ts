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

    const res = await query(`SELECT id, key, name, enabled, created_at, updated_at FROM ai_providers ORDER BY key ASC`);
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.ai.providers] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { key, name, enabled } = body || {};
    if (!key || !name) return NextResponse.json({ error: 'key and name are required' }, { status: 400 });

    const up = await query(
      `INSERT INTO ai_providers(key, name, enabled)
       VALUES($1,$2,COALESCE($3,TRUE))
       ON CONFLICT(key)
       DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled, updated_at = NOW()
       RETURNING id, key, name, enabled, created_at, updated_at`,
      [String(key).toLowerCase().trim(), name, enabled === false ? false : true]
    );

    return NextResponse.json(up.rows[0]);
  } catch (e:any) {
    console.error('[admin.ai.providers] POST error', e);
    return NextResponse.json({ error: 'Failed to upsert provider' }, { status: 500 });
  }
}
