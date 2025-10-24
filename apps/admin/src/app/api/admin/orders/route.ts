import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;
    const q = (url.searchParams.get('q') || '').trim();

    const params: any[] = [];
    let where = '';
    if (q) {
      where = `WHERE (o.user_id ILIKE $1 OR o.image_id ILIKE $1)`;
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        o.id,
        o.user_id,
        o.image_id,
        o.notes,
        o.estimated_price_text,
        o.selected_option,
        o.selected_price_cents,
        o.actual_price_cents,
        o.created_at,
        o.updated_at,
        o.status,
        u.email AS user_email,
        i.image_url,
        i.watermarked_url,
        i.prompt
      FROM orders o
      LEFT JOIN users u ON u.id::text = o.user_id
      LEFT JOIN images i ON i.id::text = o.image_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM orders o ${where}`;

    const [rowsRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: rowsRes.rows, total: (countRes.rows[0] as any).total, page, pageSize: limit });
  } catch (e: any) {
    console.error('Admin orders list error:', e);
    return NextResponse.json({ error: 'Failed to list orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { user_id, image_id, notes = null, estimated_price_text = null, selected_option = null, selected_price_cents = null, actual_price_cents = null, status = undefined } = body || {};
    if (!user_id || !image_id) {
      return NextResponse.json({ error: 'user_id and image_id are required' }, { status: 400 });
    }

    const hasStatus = typeof status === 'string' && status.length > 0;
    const sql = hasStatus
      ? `INSERT INTO orders (user_id, image_id, notes, estimated_price_text, selected_option, selected_price_cents, actual_price_cents, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`
      : `INSERT INTO orders (user_id, image_id, notes, estimated_price_text, selected_option, selected_price_cents, actual_price_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`;

    const values = hasStatus
      ? [user_id, image_id, notes, estimated_price_text, selected_option, selected_price_cents, actual_price_cents, status]
      : [user_id, image_id, notes, estimated_price_text, selected_option, selected_price_cents, actual_price_cents];

    const ins = await query(sql, values);

    return NextResponse.json(ins.rows[0]);
  } catch (e:any) {
    console.error('Admin orders create error:', e);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
