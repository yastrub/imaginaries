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
    const { role_id, email_confirmed, subscription_plan, first_name, last_name, phone } = (body || {}) as { role_id?: number; email_confirmed?: boolean; subscription_plan?: string; first_name?: string | null; last_name?: string | null; phone?: string | null };

    const result = await withTransaction(async (tx) => {
      // Helpers: safe checks inside transaction that won't abort
      const hasTable = async (table: string): Promise<boolean> => {
        try {
          const r = await tx(`SELECT to_regclass($1) AS oid`, [`public.${table}`]);
          return !!(r.rows && r.rows[0] && r.rows[0].oid);
        } catch {
          return false;
        }
      };
      const hasColumn = async (table: string, col: string): Promise<boolean> => {
        try {
          const r = await tx(
            `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
            [table, col]
          );
          return !!(r.rows && r.rows.length);
        } catch {
          return false;
        }
      };
      const hasUsersColumn = async (col: string): Promise<boolean> => {
        try {
          const r = await tx(
            `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = $1`,
            [col]
          );
          return !!(r.rows && r.rows.length);
        } catch {
          return false;
        }
      };
      // Update simple fields
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (typeof role_id === 'number') { updates.push(`role_id = $${idx++}`); values.push(role_id); }
      if (typeof email_confirmed === 'boolean') { updates.push(`email_confirmed = $${idx++}`); values.push(email_confirmed); }
      if (typeof subscription_plan === 'string') {
        if (subscription_plan === 'auto') {
          // Derive plan from latest active/trialing subscription without risking transaction aborts.
          // 1) Check subscriptions table & required columns exist
          const subsExists = await hasTable('subscriptions');
          const subsHasUserId = subsExists && await hasColumn('subscriptions', 'user_id');
          const subsHasPlan = subsExists && await hasColumn('subscriptions', 'plan');

          let autoPlan = 'free';
          if (subsExists && subsHasUserId && subsHasPlan) {
            try {
              // Prefer latest active/trialing subscription
              const activeRes = await tx(
                `SELECT plan FROM subscriptions
                 WHERE user_id = $1 AND status IN ('active','trialing')
                 ORDER BY current_period_end DESC NULLS LAST,
                          current_period_start DESC NULLS LAST,
                          created_at DESC NULLS LAST
                 LIMIT 1`,
                [id]
              );
              if (activeRes.rows?.length) {
                autoPlan = activeRes.rows[0].plan;
              } else {
                // Fallback to most recent subscription of any status
                const anyRes = await tx(
                  `SELECT plan FROM subscriptions
                   WHERE user_id = $1
                   ORDER BY current_period_end DESC NULLS LAST,
                            current_period_start DESC NULLS LAST,
                            created_at DESC NULLS LAST
                   LIMIT 1`,
                  [id]
                );
                autoPlan = anyRes.rows?.[0]?.plan || 'free';
              }
            } catch (e:any) {
              console.warn('AUTO plan derivation failed, defaulting to free:', e?.code || e?.message);
              autoPlan = 'free';
            }
          }

          // 2) Validate against plans table only if it and key column exist; otherwise allow only 'free'
          let planOk = (autoPlan === 'free');
          const plansExists = await hasTable('plans');
          const plansHasKey = plansExists && await hasColumn('plans', 'key');
          if (plansExists && plansHasKey) {
            try {
              const planCheck = await tx('SELECT 1 FROM plans WHERE key = $1', [autoPlan]);
              planOk = !!(planCheck.rows && planCheck.rows.length);
            } catch {
              planOk = (autoPlan === 'free');
            }
          }

          const hasPlanColU = await hasUsersColumn('subscription_plan');
          if (hasPlanColU) {
            if (!planOk) {
              updates.push(`subscription_plan = 'free'`);
            } else {
              updates.push(`subscription_plan = $${idx++}`); values.push(autoPlan);
            }
          }
          if (await hasUsersColumn('subscription_updated_at')) {
            updates.push(`subscription_updated_at = NOW()`);
          }
        } else {
          // Validate provided plan exists by key
          const planCheck = await tx('SELECT 1 FROM plans WHERE key = $1', [subscription_plan]);
          if (!planCheck.rows || planCheck.rows.length === 0) {
            throw Object.assign(new Error('Invalid subscription_plan'), { status: 400 });
          }
          // Update plan if column exists; most schemas have it
          const hasPlanCol = await hasUsersColumn('subscription_plan');
          if (hasPlanCol) {
            updates.push(`subscription_plan = $${idx++}`); values.push(subscription_plan);
          }
          if (await hasUsersColumn('subscription_updated_at')) {
            updates.push(`subscription_updated_at = NOW()`);
          }
        }
      }
      if (typeof first_name === 'string' || first_name === null) {
        updates.push(`first_name = $${idx++}`); values.push(first_name ?? null);
      }
      if (typeof last_name === 'string' || last_name === null) {
        updates.push(`last_name = $${idx++}`); values.push(last_name ?? null);
      }
      if (typeof phone === 'string' || phone === null) {
        updates.push(`phone = $${idx++}`); values.push(phone ?? null);
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
