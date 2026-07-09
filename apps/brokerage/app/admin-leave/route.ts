import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '../../lib/adminView';

// Exit staff "admin view" — clear the cookie and return to the normal store.
export async function GET(req: NextRequest) {
  // Behind the reverse proxy req.url is localhost:3002 — redirect via the public origin.
  const res = NextResponse.redirect(new URL('/', process.env.BROKERAGE_URL || req.url));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
