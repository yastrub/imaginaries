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

    const url = new URL(req.url);
    const setId = url.searchParams.get('preset_set_id');

    let where = '';
    const params: any[] = [];
    if (setId) { where = 'WHERE preset_set_id = $1'; params.push(setId); }

    const res = await query(
      `SELECT id, preset_set_id, key, label, payload, is_default, sort_order, created_at, updated_at
       FROM presets
       ${where}
       ORDER BY sort_order ASC, label ASC`,
      params
    );
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.presets] GET error', e);
    return NextResponse.json({ error: 'Failed to list presets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { preset_set_id, key, label, payload, is_default, sort_order } = body || {};
    if (!preset_set_id || !key || !label) {
      return NextResponse.json({ error: 'preset_set_id, key and label are required' }, { status: 400 });
    }

    if (is_default === true) {
      await query(`UPDATE presets SET is_default = FALSE WHERE preset_set_id = $1 AND is_default = TRUE`, [preset_set_id]);
    }

    const ins = await query(
      `INSERT INTO presets (preset_set_id, key, label, payload, is_default, sort_order)
       VALUES ($1,$2,$3,COALESCE($4,'{}'::jsonb),COALESCE($5,FALSE),COALESCE($6,0))
       RETURNING id, preset_set_id, key, label, payload, is_default, sort_order, created_at, updated_at`,
      [preset_set_id, key, label, payload ?? {}, is_default === true, typeof sort_order === 'number' ? sort_order : 0]
    );
    return NextResponse.json(ins.rows[0]);
  } catch (e:any) {
    console.error('[admin.presets] POST error', e);
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 });
  }
}
