import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireAdmin } from '@/server/auth';
import bcrypt from 'bcryptjs';

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
      email: 'u.email',
      subscription_plan: 'u.subscription_plan',
      email_confirmed: 'u.email_confirmed',
      created_at: 'u.created_at',
      last_login_at: 'u.last_login_at',
      role_name: 'r.name',
    };
    const sortField = sortFieldMap[sortFieldRaw as keyof typeof sortFieldMap] || 'u.created_at';
    const orderBy = `${sortField} ${sortOrder}`;

    let where = '';
    const params: any[] = [];
    if (q) {
      where = 'WHERE u.email ILIKE $1';
      params.push(`%${q}%`);
    }

    const usersSql = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.email_confirmed,
        u.subscription_plan,
        u.role_id,
        r.name AS role_name,
        u.initial_ip,
        u.last_ip,
        u.last_user_agent,
        u.created_at,
        u.last_login_at
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM users u ${where}`;

    const [usersResult, countResult] = await Promise.all([
      query(usersSql, [...params, limit, offset]),
      query(countSql, params)
    ]);

    return NextResponse.json({
      data: usersResult.rows,
      total: (countResult.rows[0] as any).total,
      page,
      pageSize: limit,
    });
  } catch (e: any) {
    console.error('Admin users list error:', e);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      email,
      password,
      role_id,
      subscription_plan,
      email_confirmed,
      first_name,
      last_name,
      phone,
    } = (body || {}) as {
      email?: string;
      password?: string;
      role_id?: number;
      subscription_plan?: string;
      email_confirmed?: boolean;
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    };

    if (!email || !password || typeof role_id !== 'number') {
      return NextResponse.json({ error: 'email, password and role_id are required' }, { status: 400 });
    }
    const emailNorm = String(email).trim().toLowerCase();

    // Validate role exists
    const roleRes = await query<{ id: number }>('SELECT id FROM roles WHERE id = $1', [role_id]);
    if (!roleRes.rows.length) return NextResponse.json({ error: 'Invalid role_id' }, { status: 400 });

    // Validate plan if provided; allow special 'auto' which defaults to 'free' on create
    let planForInsert: string | null = subscription_plan ?? null;
    if (subscription_plan) {
      if (subscription_plan === 'auto') {
        planForInsert = 'free';
      } else {
        const planRes = await query('SELECT 1 FROM plans WHERE key = $1', [subscription_plan]);
        if (!planRes.rows.length) return NextResponse.json({ error: 'Invalid subscription_plan' }, { status: 400 });
      }
    }

    const hash = await bcrypt.hash(password, 10);

    // Insert user
    const insertSql = `
      INSERT INTO users (email, password, role_id, subscription_plan, email_confirmed, first_name, last_name, phone, subscription_updated_at)
      VALUES ($1, $2, $3, COALESCE($4, 'free'), COALESCE($5, true), $6, $7, $8, NOW())
      RETURNING id
    `;
    let userId: string;
    try {
      const ins = await query<{ id: string }>(insertSql, [emailNorm, hash, role_id, planForInsert, email_confirmed ?? true, first_name ?? null, last_name ?? null, phone ?? null]);
      userId = ins.rows[0].id;
    } catch (e: any) {
      if (e?.code === '23505') {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
      throw e;
    }

    // Return created record
    const res2 = await query(
      `SELECT 
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.phone,
         u.email_confirmed,
         u.subscription_plan,
         u.role_id,
         r.name AS role_name,
         u.created_at,
         u.last_login_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );
    return NextResponse.json(res2.rows[0]);
  } catch (e: any) {
    console.error('Admin create user error:', e);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
