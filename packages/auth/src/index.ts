import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { prisma } from '@noc/db';
import { authConfig } from './config.base';
import { verifyPassword } from './password';
import { verifyOtp, verifyEmailOtp, normalizePhone } from './otp';
import { currentSite, ownerAllowsSite } from './site';
import { getEffectivePermissions, hasPermission } from './rbac';
import { loginKey, loginRetryAfter, recordLoginFail, resetLogin } from './loginGuard';

/**
 * Collapse every spelling of one phone into a SINGLE lockout key.
 *
 * `loginKey` only trimmed + lowercased, so `010…`, `+2010…`, `002010…` and spaced/parenthesised
 * variants each got their own failure counter — an attacker could keep guessing the same
 * account's password after every nominal lockout. Usernames and emails are left as typed
 * (loginKey lowercases them).
 */
function canonicalIdent(ident: string): string {
  const t = ident.trim();
  return /^[+0-9][0-9\s()+-]*$/.test(t) ? normalizePhone(t) : t;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Staff: identifier (email / username / phone) + password OR an SMS/email OTP code.
    Credentials({
      id: 'staff',
      name: 'Staff',
      credentials: { identifier: {}, email: {}, password: {}, code: {} },
      async authorize(creds) {
        // `identifier` is the field the login page sends; `email` is kept for backward-compat.
        const ident = String(creds?.identifier ?? creds?.email ?? '').trim();
        if (!ident) return null;
        const key = loginKey('staff', canonicalIdent(ident));
        if (loginRetryAfter(key) > 0) return null; // locked out — too many attempts
        const lower = ident.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            type: 'STAFF',
            isActive: true,
            OR: [{ email: lower }, { username: lower }, { phone: ident }, { phone: normalizePhone(ident) }],
          },
        });
        const password = String(creds?.password ?? '');
        const code = String(creds?.code ?? '');
        let ok = false;
        if (user) {
          if (password) ok = !!user.passwordHash && (await verifyPassword(password, user.passwordHash));
          // A login code may have been sent to the phone (SMS) or the email — accept either.
          else if (code)
            ok =
              (!!user.phone && (await verifyOtp(user.phone, code)).ok) ||
              (!!user.email && (await verifyEmailOtp(user.email, code)).ok);
        }
        if (!ok || !user) {
          recordLoginFail(key);
          return null;
        }
        resetLogin(key);
        const perms = await getEffectivePermissions(user.id);
        return { id: user.id, type: user.type, name: user.name, email: user.email, perms };
      },
    }),
    // Customer: phone + OTP code (verified, then the customer is upserted).
    Credentials({
      id: 'otp',
      name: 'Phone OTP',
      credentials: { phone: {}, code: {} },
      async authorize(creds) {
        const key = loginKey('customer', normalizePhone(String(creds?.phone ?? '')));
        if (loginRetryAfter(key) > 0) return null; // locked out
        const res = await verifyOtp(String(creds?.phone ?? ''), String(creds?.code ?? ''));
        if (!res.ok) {
          recordLoginFail(key);
          return null;
        }
        resetLogin(key);
        const user = await prisma.user.upsert({
          where: { phone: res.phone },
          update: { phoneVerifiedAt: new Date(), isActive: true },
          create: { type: 'CUSTOMER', phone: res.phone, phoneVerifiedAt: new Date() },
        });
        return { id: user.id, type: user.type, name: user.name, perms: [] };
      },
    }),
    // Partner (owner portal): identifier (username / email / phone) + password OR a
    // phone-OTP code. Accounts are admin-created and linked to an Owner.
    Credentials({
      id: 'partner',
      name: 'Partner',
      credentials: { identifier: {}, password: {}, code: {} },
      async authorize(creds) {
        const ident = String(creds?.identifier ?? '').trim();
        if (!ident) return null;
        const key = loginKey('partner', canonicalIdent(ident));
        if (loginRetryAfter(key) > 0) return null; // locked out
        const lower = ident.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            type: 'PARTNER',
            isActive: true,
            ownerId: { not: null },
            // Converting an owner to US hides the partner block in admin but did not disable the
            // User row, so the account could still sign in. Exclude US owners at the query.
            owner: { is: { type: { not: 'US' } } },
            OR: [{ username: lower }, { email: lower }, { phone: ident }, { phone: normalizePhone(ident) }],
          },
          include: { owner: { select: { siteNewObour: true, siteAlsawary: true } } },
        });
        // This app process serves exactly one site (NOC_SITE). The partner must be enabled for
        // it, else we reveal nothing — behave like an unknown account.
        const siteOk = !!user && ownerAllowsSite(user.owner, currentSite());
        const password = String(creds?.password ?? '');
        const code = String(creds?.code ?? '');
        let ok = false;
        if (user && siteOk) {
          if (password) ok = !!user.passwordHash && (await verifyPassword(password, user.passwordHash));
          // A login code may have been sent to the phone (SMS) or the email — accept either.
          else if (code)
            ok =
              (!!user.phone && (await verifyOtp(user.phone, code)).ok) ||
              (!!user.email && (await verifyEmailOtp(user.email, code)).ok);
        }
        if (!ok || !user || !siteOk) {
          recordLoginFail(key);
          return null;
        }
        resetLogin(key);
        return { id: user.id, type: user.type, name: user.name, perms: [], ownerId: user.ownerId };
      },
    }),
  ],
});

/**
 * Server guard for the partner portal: PARTNER session with a linked, still-eligible Owner.
 *
 * The JWT is a CACHE, not the source of truth. `isActive`, the current `ownerId` and the
 * site-access flags were only ever checked at sign-in, so turning "login enabled" off, revoking
 * a site, or converting the owner to US left an existing session fully working until the token
 * expired — exactly the case (compromise, staff offboarding) where revocation has to be instant.
 */
export async function requirePartner() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'PARTNER' || !user.ownerId) redirect('/partner/login');

  const live = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, type: true, isActive: true, ownerId: true, name: true,
      owner: { select: { type: true, siteNewObour: true, siteAlsawary: true } },
    },
  });
  if (!live || live.type !== 'PARTNER' || !live.isActive || !live.ownerId || !live.owner) redirect('/partner/login');
  // "US owners never get partner access" — enforced here as well as at login.
  if (live.owner.type === 'US') redirect('/partner/login');
  if (!ownerAllowsSite(live.owner, currentSite())) redirect('/partner/login');

  return { userId: live.id, ownerId: live.ownerId, name: live.name ?? null };
}

/**
 * Server guard for admin sections. Redirects to the staff login when the caller
 * isn't staff, or to the admin home when staff lacks the required permission.
 *
 * Permissions are re-read from the DB on every call for the same reason as above: middleware
 * only sees the token, so disabling a staff account or removing a grant previously had no
 * effect on an open session. Admin traffic is low; one extra query per guarded call is cheap
 * next to letting a revoked account keep writing.
 */
export async function requirePermission(section: string, action: string) {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'STAFF') redirect('/admin/login');

  const live = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, type: true, isActive: true },
  });
  if (!live || live.type !== 'STAFF' || !live.isActive) redirect('/admin/login');

  const perms = await getEffectivePermissions(live.id);
  if (!hasPermission(perms, section, action)) redirect('/admin');
  return { ...user, perms };
}

export * from './password';
export * from './rbac';
export * from './otp';
export * from './adminToken';
export * from './site';
export * from './rateLimit';
export { loginKey, loginRetryAfter, LOGIN_MAX_FAILS } from './loginGuard';
