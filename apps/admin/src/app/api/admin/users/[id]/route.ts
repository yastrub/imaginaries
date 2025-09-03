import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/server/db';
import { requireAdmin } from '@/server/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    const result = await query(
      `SELECT 
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.email_confirmed,
         u.subscription_plan,
         u.role_id,
         r.name AS role_name,
         u.created_at,
         u.last_login_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );
    if (!result.rows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (e: any) {
    console.error('Admin get user error:', e);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    const body = await req.json();
    const { role_id, email_confirmed, subscription_plan, first_name, last_name } = (body || {}) as { role_id?: number; email_confirmed?: boolean; subscription_plan?: string; first_name?: string | null; last_name?: string | null };

    const result = await withTransaction(async (tx) => {
      // Update simple fields
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (typeof role_id === 'number') { updates.push(`role_id = $${idx++}`); values.push(role_id); }
      if (typeof email_confirmed === 'boolean') { updates.push(`email_confirmed = $${idx++}`); values.push(email_confirmed); }
      if (typeof subscription_plan === 'string') {
        // Validate provided plan exists by key
        const planCheck = await tx('SELECT 1 FROM plans WHERE key = $1', [subscription_plan]);
        if (!planCheck.rows || planCheck.rows.length === 0) {
          throw Object.assign(new Error('Invalid subscription_plan'), { status: 400 });
        }
        updates.push(`subscription_plan = $${idx++}`); values.push(subscription_plan);
        updates.push(`subscription_updated_at = NOW()`);
      }
      if (typeof first_name === 'string' || first_name === null) {
        updates.push(`first_name = $${idx++}`); values.push(first_name ?? null);
      }
      if (typeof last_name === 'string' || last_name === null) {
        updates.push(`last_name = $${idx++}`); values.push(last_name ?? null);
      }
      if (updates.length) {
        values.push(id);
        await tx(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      }

      // Return updated record (single role model)
      const res = await tx(
        `SELECT 
           u.id,
           u.email,
           u.first_name,
           u.last_name,
           u.email_confirmed,
           u.subscription_plan,
           u.role_id,
           r.name AS role_name,
           u.created_at,
           u.last_login_at
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [id]
      );
      return res.rows[0];
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Admin update user error:', e);
    const status = e?.status || 500;
    const msg = status === 400 ? (e?.message || 'Bad Request') : 'Failed to update user';
    return NextResponse.json({ error: msg }, { status });
  }
}
