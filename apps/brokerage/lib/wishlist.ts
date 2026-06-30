// Wishlist ownership: a logged-in customer (userId) or an anonymous visitor via a
// `wl_anon` cookie. Read-only here (no cookie writes) so it's safe in server components;
// the cookie is created lazily inside the wishlist server actions.
import { cookies } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

export const ANON_COOKIE = 'wl_anon';

export type Owner = { userId: string | null; anonId: string | null; keys: string[] };

/** Resolve the current owner without creating a cookie. `keys` are the ownerKeys to query. */
export async function resolveOwner(): Promise<Owner> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  const keys: string[] = [];
  if (userId) keys.push(`u:${userId}`);
  if (anonId) keys.push(`a:${anonId}`);
  return { userId, anonId, keys };
}

/** Listing ids saved across all the owner's lists (for the heart "saved" state). */
export async function wishlistListingIds(): Promise<Set<string>> {
  const { keys } = await resolveOwner();
  if (!keys.length) return new Set();
  const items = await prisma.wishlistItem.findMany({
    where: { list: { ownerKey: { in: keys } } },
    select: { listingId: true },
  });
  return new Set(items.map((i) => i.listingId));
}
