'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

// Toggle a land in the customer's wishlist. Returns needAuth when not signed in
// (the client then redirects to login).
export async function toggleWishlist(listingId: string): Promise<{ ok: true; saved: boolean } | { ok: false; needAuth?: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, needAuth: true };
  try {
    const existing = await prisma.wishlist.findUnique({ where: { userId_listingId: { userId, listingId } } });
    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      revalidatePath('/account');
      return { ok: true, saved: false };
    }
    await prisma.wishlist.create({ data: { userId, listingId } });
    revalidatePath('/account');
    return { ok: true, saved: true };
  } catch (e) {
    console.error('toggleWishlist failed', e);
    return { ok: false };
  }
}
