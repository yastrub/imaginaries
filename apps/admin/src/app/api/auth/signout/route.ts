import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/server/auth';

export async function POST() {
  const res = NextResponse.json({ message: 'Signed out successfully' });
  clearAuthCookie(res);
  return res;
}
