import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

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
      company_name: 'p.company_name',
      contact_name: 'p.contact_name',
      email: 'p.email',
      created_at: 'p.created_at',
      updated_at: 'p.updated_at',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 'p.created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = `WHERE (p.company_name ILIKE $1 OR p.contact_name ILIKE $1 OR p.email ILIKE $1)`;
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT p.id, p.company_name, p.contact_name, p.email, p.phone, p.is_active, p.created_at, p.updated_at
      FROM partners p
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM partners p ${where}`;

    const [rowsRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: rowsRes.rows, total: (countRes.rows[0] as any).total, page, pageSize: limit });
  } catch (e: any) {
    console.error('Admin partners list error:', e);
    return NextResponse.json({ error: 'Failed to list partners' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      company_name,
      contact_name = null,
      email = null,
      phone = null,
      is_active = true,
    } = body || {};

    if (!company_name) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
    }

    const id = randomUUID();
    const insertSql = `
      INSERT INTO partners (id, company_name, contact_name, email, phone, is_active)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, company_name, contact_name, email, phone, is_active, created_at, updated_at
    `;
    const values = [id, company_name, contact_name, email, phone, !!is_active];

    const resIns = await query(insertSql, values);
    return NextResponse.json(resIns.rows[0]);
  } catch (e: any) {
    console.error('Admin partners create error:', e);
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
  }
}
