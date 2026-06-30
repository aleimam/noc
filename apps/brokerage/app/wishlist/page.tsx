import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { StoreShell } from '../_components/StoreShell';
import { landsByIds } from '../../lib/listings';
import { resolveOwner } from '../../lib/wishlist';
import { WishlistManager } from './WishlistManager';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const owner = await resolveOwner();

  const lists = owner.keys.length
    ? await prisma.wishlistList.findMany({
        where: { ownerKey: { in: owner.keys } },
        orderBy: { createdAt: 'asc' },
        include: { items: { orderBy: { createdAt: 'desc' }, select: { id: true, listingId: true } } },
      })
    : [];

  const allIds = [...new Set(lists.flatMap((l) => l.items.map((i) => i.listingId)))];
  const cards = await landsByIds(allIds);
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const data = lists.map((l) => ({
    id: l.id,
    name: l.name,
    items: l.items.map((i) => ({ itemId: i.id, card: cardMap.get(i.listingId) })).filter((x): x is { itemId: string; card: NonNullable<typeof x.card> } => !!x.card),
  }));

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-black text-navy-800 dark:text-soft">{L('قوائم المفضلة', 'My wishlists')}</h1>
        <WishlistManager lists={data} locale={locale} />
      </div>
    </StoreShell>
  );
}
