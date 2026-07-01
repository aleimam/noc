import Link from 'next/link';
import { Fragment } from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import type { Loc, StoreSectionKey } from '@noc/config';
import { StoreShell } from './_components/StoreShell';
import { StoreLandCard } from './_components/StoreLandCard';
import { latestLands, featuredLands, recentlySold } from '../lib/listings';
import { wishlistListingIds } from '../lib/wishlist';
import { getStorefront } from '../lib/storefront';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (t: Loc) => (locale === 'ar' ? t.ar : t.en);
  const [c, lands, featured, sold, wished, heroSetting, availableCount, soldCount] = await Promise.all([
    getStorefront(),
    latestLands(8),
    featuredLands(8),
    recentlySold(6),
    wishlistListingIds(),
    prisma.setting.findUnique({ where: { key: 'brand_alsawarey_hero' } }),
    prisma.listing.count({ where: { showOnBrokerage: true, status: 'PUBLISHED' } }),
    prisma.listing.count({ where: { showOnBrokerage: true, status: 'SOLD' } }),
  ]);
  const heroUrl = heroSetting?.value || null;

  const sectionNode = (key: StoreSectionKey) => {
    switch (key) {
      case 'quickFilters':
        return (
          <section key="qf" className="border-b border-ink-200 bg-white dark:border-white/10 dark:bg-navy-800/40">
            <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
              <div>
                <div className="mb-2 text-sm font-bold text-ink-500">{locale === 'ar' ? 'حسب السعر' : 'By price'}</div>
                <div className="flex flex-wrap gap-2.5">
                  {c.priceChips.map((ch) => (
                    <Link key={ch.href + L(ch.label)} href={ch.href} className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy-900 shadow-sm transition hover:brightness-105">
                      {L(ch.label)}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-bold text-ink-500">{locale === 'ar' ? 'حسب الميزة' : 'By feature'}</div>
                <div className="flex flex-wrap gap-2.5">
                  {c.featurePills.map((f) => (
                    <Link key={f.href + L(f.label)} href={f.href} className="rounded-full bg-gold-50 px-5 py-2.5 text-base font-bold text-gold-800 transition hover:bg-gold-100 dark:bg-gold/15 dark:text-gold">
                      {L(f.label)}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-bold text-ink-500">{locale === 'ar' ? 'حسب المساحة' : 'By area'}</div>
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {c.areaChips.map((ch) => (
                    <Link key={ch.href + L(ch.label)} href={ch.href} className="flex-none rounded-full border-2 border-ink-200 bg-white px-5 py-2.5 text-base font-bold text-navy-700 transition hover:border-gold hover:text-gold-700 dark:border-white/15 dark:bg-navy-800 dark:text-soft">
                      {L(ch.label)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      case 'featured':
        if (featured.length === 0) return null;
        return (
          <section key="ft" className="mx-auto max-w-6xl px-4 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold text-navy-800 dark:text-soft"><span className="text-gold-600">★</span> {L(c.titles.featured)}</h2>
              <Link href="/listings?featured=1" className="text-sm font-bold text-gold-700">{locale === 'ar' ? 'عرض الكل' : 'View all'} ←</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
            </div>
          </section>
        );
      case 'latest':
        return (
          <section key="lt" className="mx-auto max-w-6xl px-4 pb-10 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy-800 dark:text-soft">{L(c.titles.latest)}</h2>
              <Link href="/listings" className="text-sm font-bold text-gold-700">{locale === 'ar' ? 'عرض الكل' : 'View all'} ←</Link>
            </div>
            {lands.length === 0 ? (
              <p className="py-12 text-center text-ink-500">{locale === 'ar' ? 'لا توجد أراضٍ متاحة حالياً' : 'No lands available yet'}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {lands.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
              </div>
            )}
          </section>
        );
      case 'sellBand':
        return (
          <section key="sb" className="mx-auto max-w-6xl px-4 pb-10 pt-2">
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-navy-800 p-6 text-white sm:flex-row">
              <div className="text-center sm:text-start">
                <div className="text-lg font-bold">{L(c.sellBand.title)}</div>
                <div className="mt-1 text-sm text-white/70">{L(c.sellBand.body)}</div>
              </div>
              <Link href={c.sellBand.cta.href} className="whitespace-nowrap rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 hover:brightness-105">{L(c.sellBand.cta.label)}</Link>
            </div>
          </section>
        );
      case 'sold':
        if (sold.length === 0) return null;
        return (
          <section key="sd" className="mx-auto max-w-6xl px-4 pb-12">
            <h2 className="mb-4 text-xl font-bold text-navy-800 dark:text-soft">{L(c.titles.sold)}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sold.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <StoreShell>
      <section className="relative overflow-hidden bg-navy-800 text-white">
        {heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-navy-900/75" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <h1 className="text-3xl font-black text-gold sm:text-5xl">{L(c.hero.title)}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-white/85 sm:text-lg">{L(c.hero.subtitle)}</p>

          {c.hero.showSearch && (
            <form action="/listings" method="get" className="mx-auto mt-7 flex max-w-xl items-center gap-1 rounded-full bg-white p-1.5 shadow-lg">
              <input
                name="q"
                placeholder={L(c.hero.searchPlaceholder)}
                aria-label={locale === 'ar' ? 'ابحث' : 'Search'}
                className="min-w-0 flex-1 bg-transparent px-4 text-navy-800 outline-none placeholder:text-ink-400"
              />
              <button type="submit" className="flex-none rounded-full bg-gold px-6 py-2.5 font-bold text-navy-900 hover:brightness-105">{locale === 'ar' ? 'بحث' : 'Search'}</button>
            </form>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={c.hero.primaryCta.href} className="rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 hover:brightness-105">{L(c.hero.primaryCta.label)}</Link>
            <Link href={c.hero.secondaryCta.href} className="rounded-xl border border-white/30 px-7 py-3 font-bold text-white hover:bg-white/10">{L(c.hero.secondaryCta.label)}</Link>
          </div>

          {c.hero.stats.show && (
            <div className="mt-9 flex flex-wrap justify-center gap-x-10 gap-y-4">
              <Stat value={availableCount.toLocaleString('en')} label={L(c.hero.stats.availableLabel)} />
              {soldCount > 0 && <Stat value={soldCount.toLocaleString('en')} label={L(c.hero.stats.soldLabel)} />}
              <Stat value={L(c.hero.stats.extraValue)} label={L(c.hero.stats.extraLabel)} />
            </div>
          )}
        </div>
      </section>

      {c.sections.filter((s) => s.enabled).map((s) => <Fragment key={s.key}>{sectionNode(s.key)}</Fragment>)}

      {/* Bottom browse band — big, obvious quick filters near the end of the page */}
      <section className="border-t border-ink-200 bg-navy-50 dark:border-white/10 dark:bg-navy-800/40">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="mb-4 text-center text-xl font-bold text-navy-800 dark:text-soft">{locale === 'ar' ? 'تصفّح الأراضي بسرعة' : 'Browse lands quickly'}</h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {[...c.priceChips, ...c.featurePills].map((ch) => (
              <Link key={'b' + ch.href + L(ch.label)} href={ch.href} className="rounded-full border-2 border-gold/50 bg-white px-5 py-2.5 text-base font-bold text-navy-800 transition hover:bg-gold-50 dark:bg-navy-800 dark:text-soft">
                {L(ch.label)}
              </Link>
            ))}
          </div>
        </div>
      </section>
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
