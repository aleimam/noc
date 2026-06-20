import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { ListingCard, LanguageSwitcher, ThemeToggle } from '@noc/ui';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { showOnBrokerage: true, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 6,
    include: { propertyType: true },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'Listing', ownerId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="ALSWARY"><img src="/logo.png" alt="الصواري للاستثمار العقاري" className="h-12 w-auto" /></a>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <section className="bg-navy text-soft">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 text-center">
          <h1 className="text-3xl font-bold text-gold sm:text-4xl">
            {L('استثمارك العقاري يبدأ من هنا', 'Your real-estate investment starts here')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl opacity-80">
            {L('أراضٍ وعقارات مختارة في العبور الجديدة وما حولها', 'Selected lands and properties in New Obour and beyond')}
          </p>
          <a href="/listings" className="mt-6 inline-block rounded-md bg-gold px-6 py-3 font-semibold text-navy transition-opacity hover:opacity-90">
            {L('تصفّح العروض', 'Browse listings')}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">{L('أحدث العروض', 'Latest listings')}</h2>
          <a href="/listings" className="text-sm text-accent">{L('عرض الكل', 'View all')} →</a>
        </div>
        {listings.length === 0 && <p className="py-8 text-center opacity-60">{t('noResults')}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              href={`/listings/${l.id}`}
              cover={cover.get(l.id) ?? null}
              title={l.title}
              subtitle={L(l.propertyType.nameAr, l.propertyType.nameEn)}
              price={l.price != null ? String(l.price) : null}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
