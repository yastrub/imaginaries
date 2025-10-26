import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!isUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const res = await query(`
      SELECT 
        t.id, t.partner_id, t.name, t.mac_address, t.last_seen_ip, t.last_seen_at, t.app_version, t.os_version, t.location_text, t.is_active,
        t.created_at, t.updated_at
      FROM terminals t
      WHERE t.id = $1
    `, [id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error('Admin terminals get error:', e);
    return NextResponse.json({ error: 'Failed to get terminal' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!isUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const allowed = ['partner_id','name','mac_address','last_seen_ip','last_seen_at','app_version','os_version','location_text','is_active','pairing_code'] as const;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        fields.push(`${k} = $${idx++}`);
        values.push(body[k]);
      }
    }
    if (!fields.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    values.push(id);
    const sql = `UPDATE terminals SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, partner_id, name, mac_address, last_seen_ip, last_seen_at, app_version, os_version, location_text, is_active, created_at, updated_at`;
    const resUp = await query(sql, values);
    if (!resUp.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(resUp.rows[0]);
  } catch (e: any) {
    console.error('Admin terminals update error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to update terminal' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!isUUID(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const resDel = await query('DELETE FROM terminals WHERE id = $1 RETURNING id', [id]);
    if (!resDel.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Admin terminals delete error:', e);
    return NextResponse.json({ error: 'Failed to delete terminal' }, { status: 500 });
  }
}
