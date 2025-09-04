import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;
    const q = (url.searchParams.get('q') || '').trim();
    const sortParam = (url.searchParams.get('sort') || '').trim();

    const [sortFieldRaw, sortOrderRaw] = sortParam.split(':');
    const sortOrder = (sortOrderRaw || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortFieldMap: Record<string, string> = {
      user_email: 'u.email',
      plan: 's.plan',
      provider: 's.provider',
      provider_subscription_id: 's.provider_subscription_id',
      status: 's.status',
      is_annual: 's.is_annual',
      original_price_cents: 's.original_price_cents',
      discount: 's.discount',
      current_period_start: 's.current_period_start',
      current_period_end: 's.current_period_end',
      created_at: 's.created_at',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 's.created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = 'WHERE u.email ILIKE $1 OR s.provider_subscription_id ILIKE $1';
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        s.id,
        s.user_id,
        u.email AS user_email,
        s.plan,
        s.provider,
        s.provider_subscription_id,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.is_annual,
        s.original_price_cents,
        s.promo_code,
        s.discount::float AS discount,
        s.cancel_at,
        s.canceled_at,
        s.created_at
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.user_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id ${where}`;

    const [listRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: listRes.rows, total: (countRes.rows[0] as any)?.total ?? 0 });
  } catch (e) {
    console.error('Admin subscriptions list error:', e);
    return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: 500 });
  }
}
