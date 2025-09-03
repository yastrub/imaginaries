import { NextRequest, NextResponse } from "next/server";
import { query } from "@/server/db";
import { requireAdmin } from "@/server/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0; // optional

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
      provider: 'i.provider',
      provider_invoice_id: 'i.provider_invoice_id',
      amount_total: 'i.amount_total',
      currency: 'i.currency',
      status: 'i.status',
      period_start: 'i.period_start',
      period_end: 'i.period_end',
      created_at: 'i.created_at',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 'i.created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = 'WHERE u.email ILIKE $1 OR i.provider_invoice_id ILIKE $1';
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        i.id,
        i.user_id,
        u.email AS user_email,
        i.subscription_id,
        i.provider,
        i.provider_invoice_id,
        i.amount_total,
        i.currency,
        i.status,
        i.period_start,
        i.period_end,
        i.hosted_invoice_url,
        i.invoice_pdf,
        i.created_at
      FROM invoices i
      LEFT JOIN users u ON u.id = i.user_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM invoices i LEFT JOIN users u ON u.id = i.user_id ${where}`;

    const [listRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: listRes.rows, total: (countRes.rows[0] as any)?.total ?? 0 });
  } catch (e) {
    console.error('Admin invoices list error:', e);
    return NextResponse.json({ error: 'Failed to list invoices' }, { status: 500 });
  }
}
