import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { prisma } from '@noc/db';
import { authConfig } from './config.base';
import { verifyPassword } from './password';
import { verifyOtp, normalizePhone } from './otp';
import { getEffectivePermissions, hasPermission } from './rbac';
import { loginKey, loginRetryAfter, recordLoginFail, resetLogin } from './loginGuard';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Staff: email + password.
    Credentials({
      id: 'staff',
      name: 'Staff',
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '')
          .toLowerCase()
          .trim();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const key = loginKey('staff', email);
        if (loginRetryAfter(key) > 0) return null; // locked out — too many attempts
        const user = await prisma.user.findFirst({
          where: { email, type: 'STAFF', isActive: true },
        });
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
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
        const key = loginKey('partner', ident);
        if (loginRetryAfter(key) > 0) return null; // locked out
        const lower = ident.toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            type: 'PARTNER',
            isActive: true,
            ownerId: { not: null },
            OR: [{ username: lower }, { email: lower }, { phone: ident }, { phone: normalizePhone(ident) }],
          },
        });
        const password = String(creds?.password ?? '');
        const code = String(creds?.code ?? '');
        let ok = false;
        if (user) {
          if (password) ok = !!user.passwordHash && (await verifyPassword(password, user.passwordHash));
          else if (code) ok = !!user.phone && (await verifyOtp(user.phone, code)).ok;
        }
        if (!ok || !user) {
          recordLoginFail(key);
          return null;
        }
        resetLogin(key);
        return { id: user.id, type: user.type, name: user.name, perms: [], ownerId: user.ownerId };
      },
    }),
  ],
});

/** Server guard for the partner portal: PARTNER session with a linked Owner. */
export async function requirePartner() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'PARTNER' || !user.ownerId) redirect('/partner/login');
  return { userId: user.id, ownerId: user.ownerId, name: user.name ?? null };
}

/**
 * Server guard for admin sections. Redirects to the staff login when the caller
 * isn't staff, or to the admin home when staff lacks the required permission.
 */
export async function requirePermission(section: string, action: string) {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'STAFF') redirect('/admin/login');
  if (!hasPermission(user.perms ?? [], section, action)) redirect('/admin');
  return user;
}

export * from './password';
export * from './rbac';
export * from './otp';
export * from './adminToken';
export { loginKey, loginRetryAfter, LOGIN_MAX_FAILS } from './loginGuard';
