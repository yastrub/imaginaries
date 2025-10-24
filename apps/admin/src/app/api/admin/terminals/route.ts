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
    const sortOrder = (sortOrderRaw || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortFieldMap: Record<string, string> = {
      name: 't.name',
      partner: 'p.company_name',
      app_version: 't.app_version',
      os_version: 't.os_version',
      last_seen_at: 't.last_seen_at',
      created_at: 't.created_at',
      updated_at: 't.updated_at',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 't.created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = `WHERE (t.name ILIKE $1 OR t.mac_address ILIKE $1 OR p.company_name ILIKE $1 OR p.contact_name ILIKE $1 OR p.email ILIKE $1)`;
      params.push(`%${q}%`);
    }

    const listSql = `
      SELECT 
        t.id, t.partner_id, t.name, t.mac_address, t.last_seen_ip, t.last_seen_at, t.app_version, t.os_version, t.location_text, t.is_active,
        t.preset_set_id,
        p.company_name AS partner_name,
        CASE WHEN (t.last_seen_at IS NOT NULL AND now() - t.last_seen_at < INTERVAL '3 minutes') THEN 'online' ELSE 'offline' END AS status,
        t.created_at, t.updated_at
      FROM terminals t
      LEFT JOIN partners p ON p.id = t.partner_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM terminals t LEFT JOIN partners p ON p.id = t.partner_id ${where}`;

    const [rowsRes, countRes] = await Promise.all([
      query(listSql, [...params, limit, offset]),
      query(countSql, params),
    ]);

    return NextResponse.json({ data: rowsRes.rows, total: (countRes.rows[0] as any).total, page, pageSize: limit });
  } catch (e: any) {
    console.error('Admin terminals list error:', e);
    return NextResponse.json({ error: 'Failed to list terminals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      partner_id,
      name,
      mac_address = null,
      last_seen_ip = null,
      last_seen_at = null,
      app_version = null,
      os_version = null,
      location_text = null,
      is_active = true,
      preset_set_id = null,
    } = body || {};

    if (!partner_id || !isUUID(partner_id)) {
      return NextResponse.json({ error: 'partner_id (UUID) is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const id = randomUUID();
    const insertSql = `
      INSERT INTO terminals (
        id, partner_id, name, mac_address, last_seen_ip, last_seen_at, app_version, os_version, location_text, is_active, preset_set_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, partner_id, name, mac_address, last_seen_ip, last_seen_at, app_version, os_version, location_text, is_active, preset_set_id, created_at, updated_at
    `;

    const values = [id, partner_id, name, mac_address, last_seen_ip, last_seen_at, app_version, os_version, location_text, !!is_active, preset_set_id];

    const resIns = await query(insertSql, values);
    return NextResponse.json(resIns.rows[0]);
  } catch (e: any) {
    console.error('Admin terminals create error:', e);
    return NextResponse.json({ error: 'Failed to create terminal' }, { status: 500 });
  }
}
