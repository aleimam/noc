import NextAuth from 'next-auth';
import { authConfig } from '@noc/auth/config.base';

// Edge middleware: validates the JWT and gates /admin and /app via the
// `authorized` callback. Uses ONLY the edge-safe base config (no Prisma).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/admin/:path*', '/app/:path*'],
};
