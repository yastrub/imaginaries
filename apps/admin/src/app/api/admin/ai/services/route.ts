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

    const res = await query(`
      SELECT s.id, s.key, s.api_url, s.model_key, s.params, s.enabled, s.created_at, s.updated_at,
             p.id as provider_id, p.key as provider_key, p.name as provider_name
      FROM ai_services s
      JOIN ai_providers p ON p.id = s.provider_id
      ORDER BY p.key ASC, s.key ASC
    `);
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.ai.services] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { provider_key, key, api_url, model_key, params, enabled } = body || {};
    if (!provider_key || !key || !api_url) {
      return NextResponse.json({ error: 'provider_key, key and api_url are required' }, { status: 400 });
    }

    const prov = await query(`SELECT id FROM ai_providers WHERE key = $1`, [String(provider_key).toLowerCase().trim()]);
    if (!prov.rows.length) return NextResponse.json({ error: 'Unknown provider_key' }, { status: 400 });

    const up = await query(
      `INSERT INTO ai_services(provider_id, key, api_url, model_key, params, enabled)
       VALUES ($1,$2,$3,$4,COALESCE($5,'{}'::jsonb),COALESCE($6,TRUE))
       ON CONFLICT (key)
       DO UPDATE SET api_url = EXCLUDED.api_url, model_key = EXCLUDED.model_key, params = EXCLUDED.params, enabled = EXCLUDED.enabled, updated_at = NOW()
       RETURNING id, key, api_url, model_key, params, enabled, created_at, updated_at`,
      [prov.rows[0].id, String(key).toLowerCase().trim(), api_url, model_key ?? null, params ?? {}, enabled !== false]
    );

    return NextResponse.json(up.rows[0]);
  } catch (e:any) {
    console.error('[admin.ai.services] POST error', e);
    return NextResponse.json({ error: 'Failed to upsert service' }, { status: 500 });
  }
}
