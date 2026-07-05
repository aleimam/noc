import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { ownerKeyForRead } from '@/lib/wishlist';
import { WishlistRemove } from './WishlistRemove';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const ownerKey = await ownerKeyForRead();
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const items = ownerKey
    ? await prisma.wishlistItem.findMany({
        where: { list: { ownerKey }, listing: { status: 'PUBLISHED' } },
        orderBy: { createdAt: 'desc' },
        include: { listing: { select: { id: true, title: true, price: true, typeOption: { select: { nameAr: true, nameEn: true } } } } },
      })
    : [];
  const covers = new Map<string, string>();
  if (items.length) {
    const rows = await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: items.map((i) => i.listing.id) }, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } });
    for (const r of rows) if (r.ownerId && !covers.has(r.ownerId)) covers.set(r.ownerId, r.path);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-primary">{t('wishlistTitle')}</h1>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-ink-200 p-6 text-center text-ink-600">{t('wishlistEmpty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="overflow-hidden rounded-lg border border-ink-200 bg-white shadow-sm">
              <Link href={`/market/${it.listing.id}`} className="block">
                <div className="aspect-[16/10] bg-navy-100">
                  {covers.get(it.listing.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={covers.get(it.listing.id)!} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
              </Link>
              <div className="space-y-1 p-3">
                <Link href={`/market/${it.listing.id}`} className="block font-bold text-navy-800 hover:underline">{it.listing.title}</Link>
                <div className="text-xs text-ink-500">{L(it.listing.typeOption?.nameAr ?? '', it.listing.typeOption?.nameEn ?? '')}</div>
                <div className="flex items-center justify-between">
                  {it.listing.price != null && <span className="font-num text-gold-700" dir="ltr">{Number(it.listing.price).toLocaleString('en')} {currency(locale)}</span>}
                  <WishlistRemove itemId={it.id} label={t('removeItem')} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
