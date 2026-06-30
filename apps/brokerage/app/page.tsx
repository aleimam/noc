import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { StoreShell } from './_components/StoreShell';
import { StoreLandCard } from './_components/StoreLandCard';
import { latestLands, featuredLands, recentlySold } from '../lib/listings';
import { wishlistListingIds } from '../lib/wishlist';
import { AREA_PRESETS } from '../lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [lands, featured, sold, wished, heroSetting, availableCount, soldCount] = await Promise.all([
    latestLands(8),
    featuredLands(8),
    recentlySold(6),
    wishlistListingIds(),
    prisma.setting.findUnique({ where: { key: 'brand_alsawarey_hero' } }),
    prisma.listing.count({ where: { showOnBrokerage: true, status: 'PUBLISHED' } }),
    prisma.listing.count({ where: { showOnBrokerage: true, status: 'SOLD' } }),
  ]);
  const heroUrl = heroSetting?.value || null;

  const features = [
    { label: L('ناصية', 'Corner'), href: '/listings?corner=1' },
    { label: L('شارع رئيسي', 'Main road'), href: '/listings?main=1' },
    { label: L('متوصلة بالمرافق', 'With services'), href: '/listings?services=1' },
    { label: L('على حديقة', 'Garden view'), href: '/listings?view=garden' },
    { label: L('الأرخص سعراً', 'Best price'), href: '/listings?sort=price_asc' },
  ];
  const areaChips = [
    ...AREA_PRESETS.map((a) => ({ label: `${a}`, href: `/listings?area=${a}` })),
    { label: '600–750', href: '/listings?areaMin=600&areaMax=750' },
    { label: '751–1000', href: '/listings?areaMin=751&areaMax=1000' },
    { label: L('+1000', '1000+'), href: '/listings?areaMin=1000' },
  ];

  return (
    <StoreShell>
      {/* hero */}
      <section className="relative overflow-hidden bg-navy-800 text-white">
        {heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-navy-900/75" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <h1 className="text-3xl font-black text-gold sm:text-5xl">{L('استثمارك العقاري يبدأ من هنا', 'Your land investment starts here')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            {L('أراضٍ مختارة للبيع في العبور الجديدة وما حولها — تصفّح، قارن، وتواصل معنا للشراء', 'Selected lands for sale in New Obour and beyond — browse, compare, and contact us to buy')}
          </p>

          <form action="/listings" method="get" className="mx-auto mt-7 flex max-w-xl items-center gap-1 rounded-full bg-white p-1.5 shadow-lg">
            <input
              name="q"
              placeholder={L('ابحث بالمساحة، المنطقة، أو رقم الإعلان…', 'Search by area, district, or ad number…')}
              aria-label={L('ابحث', 'Search')}
              className="min-w-0 flex-1 bg-transparent px-4 text-navy-800 outline-none placeholder:text-ink-400"
            />
            <button type="submit" className="flex-none rounded-full bg-gold px-6 py-2.5 font-bold text-navy-900 hover:brightness-105">{L('بحث', 'Search')}</button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/listings" className="rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 hover:brightness-105">{L('تصفّح الأراضي', 'Browse lands')}</Link>
            <Link href="/sell" className="rounded-xl border border-white/30 px-7 py-3 font-bold text-white hover:bg-white/10">{L('اعرض أرضك للبيع', 'Sell your land')}</Link>
          </div>

          <div className="mt-9 flex flex-wrap justify-center gap-x-10 gap-y-4">
            <Stat value={availableCount.toLocaleString('en')} label={L('أرض متاحة', 'lands available')} />
            {soldCount > 0 && <Stat value={soldCount.toLocaleString('en')} label={L('تم بيعها', 'sold')} />}
            <Stat value={L('مجانًا', 'Free')} label={L('وساطة للمشتري', 'brokerage for buyers')} />
          </div>
        </div>
      </section>

      {/* quick filters (replaces the 15 image banners) */}
      <section className="border-b border-ink-200 bg-white dark:border-white/10 dark:bg-navy-800/40">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-5">
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="rounded-full bg-gold-50 px-4 py-1.5 text-sm font-medium text-gold-800 transition hover:bg-gold-100 dark:bg-gold/15 dark:text-gold"
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {areaChips.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex-none rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-medium text-navy-700 transition hover:border-gold hover:text-gold-700 dark:border-white/15 dark:bg-navy-800 dark:text-soft"
              >
                {c.label} {L('م²', 'm²')}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-navy-800 dark:text-soft"><span className="text-gold-600">★</span> {L('عروض مميزة', 'Featured lands')}</h2>
            <Link href="/listings?featured=1" className="text-sm font-bold text-gold-700">{L('عرض الكل', 'View all')} ←</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-navy-800 dark:text-soft">{L('أحدث الأراضي', 'Latest lands')}</h2>
          <Link href="/listings" className="text-sm font-bold text-gold-700">{L('عرض الكل', 'View all')} ←</Link>
        </div>
        {lands.length === 0 ? (
          <p className="py-12 text-center text-ink-500">{L('لا توجد أراضٍ متاحة حالياً', 'No lands available yet')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lands.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
          </div>
        )}
      </section>

      {/* sell-your-land band */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-navy-800 p-6 text-white sm:flex-row">
          <div className="text-center sm:text-start">
            <div className="text-lg font-bold">{L('عندك أرض للبيع؟', 'Have land to sell?')}</div>
            <div className="mt-1 text-sm text-white/70">{L('اعرضها معنا — كشف أو تخصيص — ونتواصل معك', 'List it with us — reconciliation or allocated — and we’ll reach out')}</div>
          </div>
          <Link href="/sell" className="whitespace-nowrap rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 hover:brightness-105">{L('اعرض أرضك', 'List your land')}</Link>
        </div>
      </section>

      {sold.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">{L('تم بيعها مؤخراً', 'Recently sold')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sold.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
          </div>
        </section>
      )}
    </StoreShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-black text-gold">{value}</div>
      <div className="text-xs text-white/70">{label}</div>
    </div>
  );
}
