import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';

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
    const sortOrder = (sortOrderRaw || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const sortFieldMap: Record<string, string> = {
      key: 'p.key',
      name: 'p.name',
      max_generations_per_day: 'p.max_generations_per_day',
      max_generations_per_month: 'p.max_generations_per_month',
      max_free_generations: 'p.max_free_generations',
      stripe_price_monthly_id: 'p.stripe_price_monthly_id',
      stripe_price_annual_id: 'p.stripe_price_annual_id',
      show_watermark: 'p.show_watermark',
      allow_private_images: 'p.allow_private_images',
      price_cents: 'p.price_cents',
      annual_price_cents: 'p.annual_price_cents',
      currency: 'p.currency',
      is_active: 'p.is_active',
      is_public: 'p.is_public',
      sort_order: 'p.sort_order',
      created_at: 'p.created_at',
      updated_at: 'p.updated_at',
    };
    const hasSort = !!sortFieldRaw;
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 'p.sort_order';
    const orderBy = hasSort ? `${sortField} ${sortOrder}` : `p.sort_order ASC, p.id ASC`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = `WHERE (p.key ILIKE $1 OR p.name ILIKE $1)`;
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        p.id,
        p.key,
        p.name,
        p.description,
        p.max_generations_per_day,
        p.max_generations_per_month,
        p.max_free_generations,
        p.stripe_price_monthly_id,
        p.stripe_price_annual_id,
        p.show_watermark,
        p.allow_private_images,
        p.price_cents,
        p.annual_price_cents,
        p.currency,
        p.is_active,
        p.is_public,
        p.sort_order,
        p.created_at,
        p.updated_at
      FROM plans p
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM plans p ${where}`;

    const [rowsRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params)
    ]);

    return NextResponse.json({ data: rowsRes.rows, total: (countRes.rows[0] as any).total, page, pageSize: limit });
  } catch (e: any) {
    console.error('Admin plans list error:', e);
    return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      key,
      name,
      description = null,
      max_generations_per_day = 0,
      max_generations_per_month = 0,
      max_free_generations = 0,
      stripe_price_monthly_id = null,
      stripe_price_annual_id = null,
      show_watermark = true,
      allow_private_images = false,
      price_cents = 0,
      annual_price_cents = 0,
      currency = 'USD',
      is_active = true,
      is_public = true,
      sort_order = 0,
    } = body || {};

    if (!key || !name) {
      return NextResponse.json({ error: 'key and name are required' }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO plans (
        key, name, description, max_generations_per_day, max_generations_per_month, max_free_generations, stripe_price_monthly_id, stripe_price_annual_id, show_watermark, allow_private_images,
        price_cents, annual_price_cents, currency, is_active, is_public, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, key, name, description, max_generations_per_day, max_generations_per_month, max_free_generations, stripe_price_monthly_id, stripe_price_annual_id, show_watermark, allow_private_images,
        price_cents, annual_price_cents, currency, is_active, is_public, sort_order, created_at, updated_at
    `;

    const values = [
      key, name, description, max_generations_per_day, max_generations_per_month, max_free_generations, stripe_price_monthly_id, stripe_price_annual_id, show_watermark, allow_private_images,
      price_cents, annual_price_cents, currency, is_active, is_public, sort_order
    ];

    const resIns = await query(insertSql, values);
    return NextResponse.json(resIns.rows[0]);
  } catch (e: any) {
    console.error('Admin plans create error:', e);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
