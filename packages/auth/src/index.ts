import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { prisma } from '@noc/db';
import { authConfig } from './config.base';
import { verifyPassword } from './password';
import { verifyOtp } from './otp';
import { getEffectivePermissions, hasPermission } from './rbac';

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
        const user = await prisma.user.findFirst({
          where: { email, type: 'STAFF', isActive: true },
        });
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
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
        const res = await verifyOtp(String(creds?.phone ?? ''), String(creds?.code ?? ''));
        if (!res.ok) return null;
        const user = await prisma.user.upsert({
          where: { phone: res.phone },
          update: { phoneVerifiedAt: new Date(), isActive: true },
          create: { type: 'CUSTOMER', phone: res.phone, phoneVerifiedAt: new Date() },
        });
        return { id: user.id, type: user.type, name: user.name, perms: [] };
      },
    }),
  ],
});

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
