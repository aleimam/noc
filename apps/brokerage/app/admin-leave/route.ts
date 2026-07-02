import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '../../lib/adminView';

// Exit staff "admin view" — clear the cookie and return to the normal store.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
