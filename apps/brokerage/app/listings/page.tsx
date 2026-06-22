import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { ListingCard } from '@noc/ui';
import { currency } from '@noc/i18n';

export const dynamic = 'force-dynamic';

export default async function BrokerageListings() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { showOnBrokerage: true, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 60,
    include: { typeOption: true },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('عروضنا العقارية', 'Our listings')}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="ALSWARY"><img src="/logo.png" alt="الصواري" className="h-9 w-auto" /></a>
      </div>

      {listings.length === 0 && <p className="py-12 text-center opacity-60">{t('noResults')}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            href={`/listings/${l.id}`}
            cover={cover.get(l.id) ?? null}
            title={l.title}
            subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
            price={l.price != null ? String(l.price) : null}
            currency={currency(locale)}
          />
        ))}
      </div>
    </main>
  );
}
