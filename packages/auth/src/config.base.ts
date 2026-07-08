import type { NextAuthConfig } from 'next-auth';
import type { UserType } from '@noc/db';
import './types';

// Edge-safe base config: NO Prisma, bcrypt, or other Node-only imports. The
// middleware uses this to validate the JWT and gate routes. The real providers
// (which need Prisma/bcrypt) are layered on in the Node config (./index.ts).
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/account/login' },
  providers: [],
  callbacks: {
    // Runs in the middleware (edge). Decides access from the token alone.
    authorized({ auth, request }) {
      const { pathname, origin } = request.nextUrl;
      const user = auth?.user;
      if (pathname.startsWith('/admin')) {
        if (pathname === '/admin/login') return true;
        if (user?.type === 'STAFF') return true;
        return Response.redirect(new URL('/admin/login', origin));
      }
      if (pathname.startsWith('/partner')) {
        if (pathname === '/partner/login') return true;
        if (user?.type === 'PARTNER') return true;
        return Response.redirect(new URL('/partner/login', origin));
      }
      if (pathname.startsWith('/account')) {
        if (pathname === '/account/login') return true;
        return Boolean(user);
      }
      return true;
    },
    // Copy our custom fields into the JWT on sign-in (edge-safe — no DB call).
    jwt({ token, user }) {
      if (user) {
        const t = token as Record<string, unknown>;
        t.id = user.id;
        t.type = user.type;
        t.name = user.name ?? null;
        t.perms = user.perms ?? [];
        t.ownerId = user.ownerId ?? null;
      }
      return token;
    },
    // Expose them on the session object.
    session({ session, token }) {
      const t = token as { id?: string; type?: UserType; perms?: string[]; ownerId?: string | null };
      if (session.user) {
        session.user.id = t.id ?? '';
        session.user.type = t.type as UserType;
        session.user.perms = t.perms ?? [];
        session.user.ownerId = t.ownerId ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
