import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/server/db';
import { signJwt, setAuthCookie } from '@/server/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const clientIp = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-client-ip')
      || req.headers.get('x-real-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.ip
      || 'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const result = await query<any>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

    await query(
      `UPDATE users SET 
        last_ip = $1, 
        last_user_agent = $2, 
        last_login_at = CURRENT_TIMESTAMP 
      WHERE id = $3`,
      [clientIp, userAgent, user.id]
    );

    // Single-role model: fetch role_id and name
    const roleRes = await query<any>(
      `SELECT u.role_id, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user.id]
    );
    const roleRow = roleRes.rows[0] || {};
    const role_id: number | undefined = roleRow.role_id ?? user.role_id;
    const role_name: string | undefined = roleRow.role_name ?? undefined;
    // Backward-compat token still carries roles as array of names
    const roles = role_name ? [role_name] : [];

    const token = signJwt({ userId: user.id, email: user.email, roles });
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed,
        subscription_plan: user.subscription_plan,
        role: role_name, // legacy string
        role_id,
        role_name,
        roles, // legacy array for compatibility
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
      requiresConfirmation: !user.email_confirmed,
    });
    setAuthCookie(res, token);
    return res;
  } catch (e: any) {
    console.error('Admin signin error:', e);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
