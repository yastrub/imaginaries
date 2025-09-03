import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { query } from './db';

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'admin_token';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'change-me-admin-secret';

export type JwtPayload = { userId: string; email: string; roles: string[] };

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response | any, token: string) {
  // For NextResponse, use cookies.set on the response
  if (typeof res?.cookies?.set === 'function') {
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return;
  }
  // Fallback for route handlers using headers API
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
}

export function clearAuthCookie(res: Response | any) {
  if (typeof res?.cookies?.set === 'function') {
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' });
    return;
  }
  cookies().set(COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' });
}

export async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const decoded = verifyJwt(token);
  if (!decoded) return null;
  const result = await query<any>(
    `SELECT 
       u.id,
       u.email,
       u.email_confirmed,
       u.subscription_plan,
       u.role_id,
       r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [decoded.userId]
  );
  const user = result.rows[0];
  if (!user) return null;
  return user;
}

export async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return { authorized: false as const };
  }
  // System rule: role_id = 1 is superuser (full access)
  if ((user as any).role_id !== 1) {
    return { authorized: false as const };
  }
  return { authorized: true as const, user };
}
