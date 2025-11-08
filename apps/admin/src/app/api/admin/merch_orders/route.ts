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
      where = `WHERE (email ILIKE $1 OR id::text ILIKE $1 OR merch_type ILIKE $1 OR color ILIKE $1 OR size ILIKE $1)`;
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        id,
        status,
        merch_type,
        color,
        size,
        price_amount,
        price_currency,
        source_image_url,
        order_image_url,
        name,
        phone,
        email,
        notes,
        created_at,
        updated_at
      FROM merch_orders
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM merch_orders ${where}`;

    const [rowsRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: rowsRes.rows, total: (countRes.rows[0] as any).total, page, pageSize: limit });
  } catch (e: any) {
    console.error('Admin merch_orders list error:', e);
    return NextResponse.json({ error: 'Failed to list merch orders' }, { status: 500 });
  }
}
