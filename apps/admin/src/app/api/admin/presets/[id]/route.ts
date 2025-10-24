import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth';
import { query } from '@/server/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const res = await query(`SELECT id, preset_set_id, key, label, payload, is_default, sort_order, created_at, updated_at FROM presets WHERE id = $1`, [id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to fetch preset' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const body = await req.json();
    const { key, label, payload, is_default, sort_order } = body || {};

    if (is_default === true) {
      const cur = await query(`SELECT preset_set_id FROM presets WHERE id = $1`, [id]);
      const setId = cur.rows?.[0]?.preset_set_id;
      if (setId) await query(`UPDATE presets SET is_default = FALSE WHERE preset_set_id = $1 AND is_default = TRUE`, [setId]);
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (typeof key === 'string') { fields.push(`key = $${idx++}`); values.push(key); }
    if (typeof label === 'string') { fields.push(`label = $${idx++}`); values.push(label); }
    if (typeof payload !== 'undefined') { fields.push(`payload = $${idx++}`); values.push(payload ?? {}); }
    if (typeof is_default === 'boolean') { fields.push(`is_default = $${idx++}`); values.push(is_default); }
    if (typeof sort_order === 'number') { fields.push(`sort_order = $${idx++}`); values.push(sort_order); }
    if (!fields.length) {
      const res = await query(`SELECT id, preset_set_id, key, label, payload, is_default, sort_order, created_at, updated_at FROM presets WHERE id = $1`, [id]);
      return NextResponse.json(res.rows[0]);
    }

    values.push(id);
    const up = await query(`UPDATE presets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, preset_set_id, key, label, payload, is_default, sort_order, created_at, updated_at`, values);
    return NextResponse.json(up.rows[0]);
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const del = await query(`DELETE FROM presets WHERE id = $1 RETURNING id`, [id]);
    if (!del.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
  }
}
