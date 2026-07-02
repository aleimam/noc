'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true } | { ok: false; error: string };

async function requireCustomer(): Promise<string | null> {
  const s = await auth();
  if (s?.user?.type !== 'CUSTOMER' || !s.user.id) return null;
  return s.user.id;
}

// Stop a rationing follow (watch/found) the customer created.
export async function deleteRationingFollow(id: string): Promise<Result> {
  const userId = await requireCustomer();
  if (!userId) return { ok: false, error: 'auth' };
  const { count } = await prisma.rationingFollow.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: 'not_found' };
  revalidatePath('/account/follows');
  return { ok: true };
}

// Stop following a land area.
export async function deleteLandFollow(id: string): Promise<Result> {
  const userId = await requireCustomer();
  if (!userId) return { ok: false, error: 'auth' };
  const { count } = await prisma.landFollow.deleteMany({ where: { id, userId } });
  if (!count) return { ok: false, error: 'not_found' };
  revalidatePath('/account/follows');
  return { ok: true };
}
