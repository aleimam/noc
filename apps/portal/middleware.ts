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
  if (pathname.startsWith('/app') && pathname !== '/app/login' && !user) {
    return NextResponse.redirect(new URL('/app/login', origin));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ['/admin/:path*', '/app/:path*'],
};
