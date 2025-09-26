import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(_req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const res = await query(
      `SELECT o.*, u.email AS user_email, i.image_url, i.prompt
       FROM orders o
       LEFT JOIN users u ON u.id::text = o.user_id
       LEFT JOIN images i ON i.id::text = o.image_id
       WHERE o.id = $1::uuid`,
      [id]
    );

    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error('Admin orders get error:', e);
    return NextResponse.json({ error: 'Failed to get order' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const { notes = null, actual_price_cents = null, status = null } = body || {};

    const res = await query(
      `UPDATE orders SET 
         notes = COALESCE($2, notes),
         actual_price_cents = COALESCE($3, actual_price_cents),
         status = COALESCE(CASE WHEN $4::text IS NULL OR $4 = '' THEN NULL ELSE $4::order_status END, status),
         updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [id, notes, actual_price_cents, status]
    );

    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    console.error('Admin orders update error:', e);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
