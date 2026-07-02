import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken, signAdminToken } from '@noc/auth';
import { prisma } from '@noc/db';
import { ADMIN_COOKIE } from '../../lib/adminView';

const EIGHT_HOURS = 8 * 60 * 60;

// Verify the signed token from the New Obour backend; if it maps to an active STAFF user,
// set an httpOnly "admin view" cookie (~8h) so owner details show across the store.
export async function GET(req: NextRequest) {
  const uid = verifyAdminToken(req.nextUrl.searchParams.get('t'));
  const res = NextResponse.redirect(new URL('/', req.url));
  if (!uid) return res;

  const staff = await prisma.user.findFirst({ where: { id: uid, type: 'STAFF', isActive: true }, select: { id: true } });
  if (!staff) return res;

  res.cookies.set(ADMIN_COOKIE, signAdminToken(staff.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: EIGHT_HOURS,
  });
  return res;
}
