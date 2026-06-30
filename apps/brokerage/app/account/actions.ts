'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ANON_COOKIE } from '../../lib/wishlist';

type Result = { ok: true } | { ok: false; error?: string };

/** Resolve the owner inside an action — may CREATE the anon cookie, and merges any
 *  anonymous lists into the account once the visitor is logged in. */
async function ownerForWrite(): Promise<{ ownerKey: string; userId: string | null }> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const jar = await cookies();
  let anonId = jar.get(ANON_COOKIE)?.value ?? null;

  if (userId) {
    // merge any anon lists into the account, then drop the cookie
    if (anonId) {
      await prisma.wishlistList.updateMany({ where: { ownerKey: `a:${anonId}` }, data: { ownerKey: `u:${userId}`, userId } });
      jar.delete(ANON_COOKIE);
    }
    return { ownerKey: `u:${userId}`, userId };
  }
  if (!anonId) {
    anonId = randomUUID();
    jar.set(ANON_COOKIE, anonId, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }
  return { ownerKey: `a:${anonId}`, userId: null };
}

async function defaultList(ownerKey: string, userId: string | null): Promise<string> {
  const existing = await prisma.wishlistList.findFirst({ where: { ownerKey }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.wishlistList.create({ data: { ownerKey, userId, name: 'المفضلة' }, select: { id: true } });
  return created.id;
}

/** Toggle a land in the owner's default list (or a specific list). Guests allowed. */
export async function toggleWishlist(listingId: string, listId?: string): Promise<{ ok: true; saved: boolean } | { ok: false }> {
  try {
    const { ownerKey, userId } = await ownerForWrite();
    const targetListId = listId ?? (await defaultList(ownerKey, userId));
    const existing = await prisma.wishlistItem.findUnique({ where: { listId_listingId: { listId: targetListId, listingId } } });
    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      revalidatePath('/wishlist');
      return { ok: true, saved: false };
    }
    await prisma.wishlistItem.create({ data: { listId: targetListId, listingId } });
    revalidatePath('/wishlist');
    return { ok: true, saved: true };
  } catch (e) {
    console.error('toggleWishlist failed', e);
    return { ok: false };
  }
}

export async function createList(name: string): Promise<Result> {
  try {
    const { ownerKey, userId } = await ownerForWrite();
    await prisma.wishlistList.create({ data: { ownerKey, userId, name: name.trim() || 'قائمة' } });
    revalidatePath('/wishlist');
    return { ok: true };
  } catch (e) {
    console.error('createList failed', e);
    return { ok: false };
  }
}

async function ownsList(listId: string): Promise<boolean> {
  const { ownerKey } = await ownerForWrite();
  const l = await prisma.wishlistList.findUnique({ where: { id: listId }, select: { ownerKey: true } });
  return !!l && l.ownerKey === ownerKey;
}

export async function renameList(listId: string, name: string): Promise<Result> {
  if (!(await ownsList(listId))) return { ok: false };
  await prisma.wishlistList.update({ where: { id: listId }, data: { name: name.trim() || 'قائمة' } });
  revalidatePath('/wishlist');
  return { ok: true };
}

export async function deleteList(listId: string): Promise<Result> {
  if (!(await ownsList(listId))) return { ok: false };
  await prisma.wishlistList.delete({ where: { id: listId } });
  revalidatePath('/wishlist');
  return { ok: true };
}

export async function removeItem(itemId: string): Promise<Result> {
  const { ownerKey } = await ownerForWrite();
  const item = await prisma.wishlistItem.findUnique({ where: { id: itemId }, select: { list: { select: { ownerKey: true } } } });
  if (!item || item.list.ownerKey !== ownerKey) return { ok: false };
  await prisma.wishlistItem.delete({ where: { id: itemId } });
  revalidatePath('/wishlist');
  return { ok: true };
}
