import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth';
import { query, withTransaction } from '@/server/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const res = await query(`SELECT id, name, slug, is_default, created_at, updated_at FROM preset_sets WHERE id = $1`, [id]);
    if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e:any) {
    console.error('[admin.preset_sets.id] GET error', e);
    return NextResponse.json({ error: 'Failed to fetch preset set' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const body = await req.json();
    const { name, slug, is_default } = body || {};

    const result = await withTransaction(async (tx) => {
      if (is_default === true) {
        await tx(`UPDATE preset_sets SET is_default = FALSE WHERE is_default = TRUE`);
      }
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (typeof name === 'string') { fields.push(`name = $${idx++}`); values.push(name); }
      if (typeof slug === 'string') { fields.push(`slug = $${idx++}`); values.push(String(slug).toLowerCase().trim()); }
      if (typeof is_default === 'boolean') { fields.push(`is_default = $${idx++}`); values.push(is_default); }
      if (!fields.length) return (await tx(`SELECT id, name, slug, is_default, created_at, updated_at FROM preset_sets WHERE id = $1`, [id])).rows[0];
      values.push(id);
      const up = await tx(`UPDATE preset_sets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, name, slug, is_default, created_at, updated_at`, values);
      return up.rows[0];
    });

    return NextResponse.json(result);
  } catch (e:any) {
    console.error('[admin.preset_sets.id] PATCH error', e);
    return NextResponse.json({ error: 'Failed to update preset set' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    const del = await query(`DELETE FROM preset_sets WHERE id = $1 RETURNING id`, [id]);
    if (!del.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e:any) {
    console.error('[admin.preset_sets.id] DELETE error', e);
    return NextResponse.json({ error: 'Failed to delete preset set' }, { status: 500 });
  }
}
