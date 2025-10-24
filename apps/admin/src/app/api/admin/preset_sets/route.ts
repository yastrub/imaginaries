import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth';
import { query, withTransaction } from '@/server/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const res = await query(`SELECT id, name, slug, is_default, created_at, updated_at FROM preset_sets ORDER BY name ASC`);
    return NextResponse.json({ data: res.rows });
  } catch (e:any) {
    console.error('[admin.preset_sets] GET error', e);
    return NextResponse.json({ error: 'Failed to list preset sets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, slug, is_default } = body || {};
    if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });

    const result = await withTransaction(async (tx) => {
      if (is_default === true) {
        await tx(`UPDATE preset_sets SET is_default = FALSE WHERE is_default = TRUE`);
      }
      const ins = await tx(
        `INSERT INTO preset_sets (name, slug, is_default)
         VALUES ($1,$2,COALESCE($3,FALSE))
         RETURNING id, name, slug, is_default, created_at, updated_at`,
        [name, String(slug).toLowerCase().trim(), is_default === true]
      );
      return ins.rows[0];
    });

    return NextResponse.json(result);
  } catch (e:any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'Slug must be unique' }, { status: 409 });
    }
    console.error('[admin.preset_sets] POST error', e);
    return NextResponse.json({ error: 'Failed to create preset set' }, { status: 500 });
  }
}
