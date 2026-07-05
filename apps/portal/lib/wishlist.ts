import { cookies } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

// Wishlist ownership mirrors the storefront (shared WishlistList/WishlistItem models):
// logged-in → ownerKey `u:<userId>` (so a customer's saved items unify across both sites);
// guests → `a:<anonId>` via cookie. Read-only helpers here; writes live in the action.
export const ANON_COOKIE = 'noc_anon';

export async function ownerKeyForRead(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return `u:${session.user.id}`;
  const jar = await cookies();
  const anon = jar.get(ANON_COOKIE)?.value;
  return anon ? `a:${anon}` : null;
}

/** Which of the given listing ids the current owner has wishlisted (for saved-state on cards). */
export async function wishedSet(listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const ownerKey = await ownerKeyForRead();
  if (!ownerKey) return new Set();
  const rows = await prisma.wishlistItem.findMany({
    where: { listingId: { in: listingIds }, list: { ownerKey } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}
