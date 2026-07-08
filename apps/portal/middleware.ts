import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@noc/auth/config.base';

const { auth } = NextAuth(authConfig);

// Edge middleware: gates /admin (STAFF) and /app (any signed-in user), and stamps
// x-pathname so the i18n layer can default the admin area to English and customer
// areas to Arabic. Server-side layout guards remain the source of truth for access.
export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const user = req.auth?.user;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && user?.type !== 'STAFF') {
    return NextResponse.redirect(new URL('/admin/login', origin));
  }
  if (pathname.startsWith('/account') && pathname !== '/account/login' && !user) {
    return NextResponse.redirect(new URL('/account/login', origin));
  }
  if (pathname.startsWith('/partner') && pathname !== '/partner/login' && user?.type !== 'PARTNER') {
    return NextResponse.redirect(new URL('/partner/login', origin));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Stable first-party visitor id for the per-browser rationing quota (New Obour anti-scrape,
  // see lib/rationing/quota.ts). Not tied to identity — just a counter key that survives
  // longer than an IP and doesn't false-block users sharing a carrier IP.
  if (!req.cookies.get('nob_v')) {
    res.cookies.set('nob_v', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 180, // 180 days
    });
  }
  return res;
});

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/partner/:path*', '/rationing/:path*'],
};
