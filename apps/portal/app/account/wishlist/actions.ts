'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ANON_COOKIE } from '../../../lib/wishlist';

// Resolve owner for a write; may create the anon cookie and merge anon lists into the account.
async function ownerForWrite(): Promise<{ ownerKey: string; userId: string | null }> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const jar = await cookies();
  const anonId = jar.get(ANON_COOKIE)?.value ?? null;
  if (userId) {
    if (anonId) {
      await prisma.wishlistList.updateMany({ where: { ownerKey: `a:${anonId}` }, data: { ownerKey: `u:${userId}`, userId } });
      jar.delete(ANON_COOKIE);
    }
    return { ownerKey: `u:${userId}`, userId };
  }
  let id = anonId;
  if (!id) {
    id = randomUUID();
    jar.set(ANON_COOKIE, id, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }
  return { ownerKey: `a:${id}`, userId: null };
}

async function defaultList(ownerKey: string, userId: string | null): Promise<string> {
  const existing = await prisma.wishlistList.findFirst({ where: { ownerKey }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.wishlistList.create({ data: { ownerKey, userId, name: 'المفضلة' }, select: { id: true } });
  return created.id;
}

export async function toggleWishlist(listingId: string): Promise<{ ok: true; saved: boolean } | { ok: false }> {
  try {
    const { ownerKey, userId } = await ownerForWrite();
    const listId = await defaultList(ownerKey, userId);
    const existing = await prisma.wishlistItem.findUnique({ where: { listId_listingId: { listId, listingId } } });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      revalidatePath('/account/wishlist');
      return { ok: true, saved: false };
    }
    await prisma.wishlistItem.create({ data: { listId, listingId } });
    revalidatePath('/account/wishlist');
    return { ok: true, saved: true };
  } catch (e) {
    console.error('toggleWishlist failed', e);
    return { ok: false };
  }
}

export async function removeWishlistItem(itemId: string): Promise<{ ok: true } | { ok: false }> {
  try {
    await prisma.wishlistItem.delete({ where: { id: itemId } });
    revalidatePath('/account/wishlist');
    return { ok: true };
  } catch (e) {
    console.error('removeWishlistItem failed', e);
    return { ok: false };
  }
}
