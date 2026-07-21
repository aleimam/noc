import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '../../lib/adminView';

// Exit staff "admin view" — clear the cookie and return to the normal store.
export async function GET(req: NextRequest) {
  // Behind the reverse proxy req.url is the INTERNAL localhost:3002 origin — never fall back
  // to it (topology leak + broken public redirect). Use the known public origin.
  const res = NextResponse.redirect(new URL('/', process.env.BROKERAGE_URL || 'https://alsawarey.com'));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
