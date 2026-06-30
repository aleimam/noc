import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StoreShell } from './_components/StoreShell';
import { StoreLandCard } from './_components/StoreLandCard';
import { latestLands, featuredLands, recentlySold } from '../lib/listings';
import { wishlistListingIds } from '../lib/wishlist';
import { BANNERS } from '../lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [lands, featured, sold, wished] = await Promise.all([latestLands(8), featuredLands(8), recentlySold(6), wishlistListingIds()]);

  return (
    <StoreShell>
      <section className="relative overflow-hidden bg-navy-800 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/market/heroes/Axis.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-3xl font-black text-gold sm:text-5xl">{L('استثمارك العقاري يبدأ من هنا', 'Your investment starts here')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">{L('أراضٍ مختارة للبيع في العبور الجديدة وما حولها — تصفّح، قارن، وتواصل معنا للشراء', 'Selected lands for sale in New Obour and beyond')}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/listings" className="rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 hover:brightness-105">{L('تصفّح الأراضي', 'Browse lands')}</Link>
            <Link href="/sell" className="rounded-xl border border-white/30 px-7 py-3 font-bold text-white hover:bg-white/10">{L('اعرض أرضك للبيع', 'Sell your land')}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-lg font-bold text-navy-800">{L('تصفّح حسب', 'Browse by')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BANNERS.map((b) => (
            <Link key={b.img} href={b.href} className="overflow-hidden rounded-xl border border-ink-200 bg-white transition hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/market/banners/${b.img}`} alt={b.alt} className="h-auto w-full" />
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-navy-800 dark:text-soft"><span className="text-gold-600">★</span> {L('عروض مميزة', 'Featured lands')}</h2>
            <Link href="/listings?featured=1" className="text-sm font-bold text-gold-700">{L('عرض الكل', 'View all')} ←</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-6">
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
