import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const res = await query(`
      SELECT id, key, name, description, max_generations_per_day, show_watermark, allow_private_images,
             price_cents, annual_price_cents, currency, is_active, is_public, sort_order, created_at, updated_at
      FROM plans WHERE id = $1
    `, [id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error('Admin plans get error:', e);
    return NextResponse.json({ error: 'Failed to get plan' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const allowed = ['key','name','description','max_generations_per_day','show_watermark','allow_private_images','price_cents','annual_price_cents','currency','is_active','is_public','sort_order'] as const;
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
    const sql = `UPDATE plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, key, name, description, max_generations_per_day, show_watermark, allow_private_images, price_cents, annual_price_cents, currency, is_active, is_public, sort_order, created_at, updated_at`;
    const res = await query(sql, values);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error('Admin plans update error:', e);
    // Unique violations or others
    return NextResponse.json({ error: e?.message || 'Failed to update plan' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const res = await query('DELETE FROM plans WHERE id = $1 RETURNING id', [id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Admin plans delete error:', e);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
