import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth';
import { query } from '@/server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const scope = url.searchParams.get('scope');
    const key = url.searchParams.get('key');
    const where: string[] = [];
    const params: any[] = [];
    if (scope) { where.push(`scope = $${params.length + 1}`); params.push(scope); }
    if (key) { where.push(`key = $${params.length + 1}`); params.push(key); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await query(
      `SELECT id, scope, key, content, version, is_active, created_at, updated_at
       FROM ai_prompts
       ${whereSql}
       ORDER BY scope ASC, key ASC, version DESC`,
      params
    );
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.ai.prompts] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { scope, key, content, is_active } = body || {};
    if (!scope || !key || typeof content !== 'string') {
      return NextResponse.json({ error: 'scope, key and content are required' }, { status: 400 });
    }

    // Next version = max(version)+1 for this scope/key
    const vRes = await query(`SELECT COALESCE(MAX(version),0)+1 AS v FROM ai_prompts WHERE scope = $1 AND key = $2`, [scope, key]);
    const version = vRes.rows?.[0]?.v || 1;

    // If activating, deactivate previous active for same scope/key
    if (is_active === true) {
      await query(`UPDATE ai_prompts SET is_active = FALSE WHERE scope = $1 AND key = $2`, [scope, key]);
    }

    const ins = await query(
      `INSERT INTO ai_prompts(scope, key, content, version, is_active)
       VALUES ($1,$2,$3,$4,COALESCE($5, FALSE))
       RETURNING id, scope, key, content, version, is_active, created_at, updated_at`,
      [scope, key, content, version, is_active === true]
    );

    return NextResponse.json(ins.rows[0]);
  } catch (e:any) {
    console.error('[admin.ai.prompts] POST error', e);
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
  }
}
