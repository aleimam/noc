'use server';

import { revalidatePath } from 'next/cache';
import { auth, hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true } | { ok: false; error: string };

export async function updateAccount(input: { name?: string; email?: string }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') return { ok: false, error: 'unauthorized' };
  try {
    const email = (input.email ?? '').trim().toLowerCase();
    if (!email) return { ok: false, error: 'email_required' };
    await prisma.user.update({ where: { id: session.user.id }, data: { name: input.name?.trim() || null, email } });
    revalidatePath('/admin/settings/account');
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    return { ok: false, error: code === 'P2002' ? 'email_taken' : 'failed' };
  }
}

export async function changePassword(input: { current: string; next: string }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') return { ok: false, error: 'unauthorized' };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(input.current, user.passwordHash))) {
    return { ok: false, error: 'wrong_password' };
  }
  if (input.next.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'password_short' };
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: await hashPassword(input.next) } });
  return { ok: true };
}
