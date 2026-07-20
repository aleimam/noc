import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { pageMeta } from '../lib/seo';
import { newObourVisibility } from '@noc/partner-portal/visibility';
import { ListingCard } from '@noc/ui';
import { currency } from '@noc/i18n';
import { isStoredPrice } from '@noc/config';
import { getModuleVisibility } from '../lib/modules';
import { SiteShell } from './_components/SiteShell';
import { SeoIntro } from './_components/SeoText';
import { getSeoIntro } from '../lib/seoContent';
import { marketHref } from '../lib/listings';
import { coversForListings } from '../lib/listingCovers';

export const dynamic = 'force-dynamic';

// Rich, human-written snippet for search results. The old layout-level description was so
// short/generic that Google ignored it and scraped the services-card fragments instead
// («الخدمات ؛ كشوف التقنين …»). ~155 chars, keyword-carrying, plus OG for link previews.
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title:
      locale === 'en'
        ? 'New Obour — the free services portal for New Obour City'
        : 'العبور الجديدة — بوابة الخدمات المجانية لمدينة العبور الجديدة',
    description:
      locale === 'en'
        ? 'Free portal for New Obour City residents: search your name in the legalization ledgers, browse lands and units for sale, explore districts and neighborhoods, and follow city news and per-m² prices.'
        : 'بوابة مجانية لأهالي مدينة العبور الجديدة: ابحث عن اسمك في كشوف التقنين، تصفّح الأراضي والوحدات المعروضة للبيع، تعرّف على الأحياء والمجاورات ومميزاتها، وتابع أخبار المدينة ومتوسط أسعار المتر.',
    path: '/',
    images: ['/brand/logo'],
    locale,
  });
}

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const tn = await getTranslations('nav');
  const tr = await getTranslations('rationing');
  const tl = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', ...newObourVisibility() },
    orderBy: { publishedAt: 'desc' },
    take: 4,
    include: { typeOption: true },
  });
  const ids = listings.map((l) => l.id);
  // Cover chain (location map → photo) — shared with market/similar/owner cards.
  const cover = await coversForListings(ids);

  const vis = await getModuleVisibility();
  const homeIntro = await getSeoIntro('home', locale);
  const allServices = [
    { key: 'rationing', href: '/rationing', title: tr('title'), desc: L('ابحث عن اسمك في كشوف التقنين', 'Find your name in the legalization ledgers'), icon: 'M3 5h13M3 12h13M3 19h7M21 8l-4 4 4 4' },
    { key: 'market', href: '/market', title: t('title'), desc: L('تصفّح الأراضي والوحدات المعروضة', 'Browse land plots and units for sale'), icon: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-3' },
    { key: 'explore', href: '/explore', title: tl('title'), desc: L('الأحياء والمجاورات ومميزاتها', 'Districts, neighborhoods and their features'), icon: 'M12 21s-7-5.2-7-11a7 7 0 0114 0c0 5.8-7 11-7 11z' },
    { key: 'news', href: '/news', title: tn('news'), desc: L('أخبار المرافق والطرق والتسليمات', 'Utilities, roads and handover news'), icon: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5' },
    { key: 'guide', href: '/guide', title: tn('guide'), desc: L('خطوات الترخيص والبناء والاستلام', 'Licensing, building and handover steps'), icon: 'M6 2h9l5 5v15H6zM14 2v5h5' },
    { key: 'priceIndex', href: '/price-index', title: tn('priceIndex'), desc: L('متوسط أسعار المتر حسب الحي', 'Average price per m² by district'), icon: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9' },
  ] as const;
  // Hide services whose module is turned off in the backend.
  const services = allServices.filter((s) => vis[s.key] !== false);

  return (
    <SiteShell active="home">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-soft">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative mx-auto max-w-[1000px] px-6 py-10 text-center sm:py-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo" alt="" className="mx-auto mb-3 h-12 w-auto sm:h-14" />
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tn('brand')}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-soft/80 sm:text-base">
            {L('بوابتك الرسمية لخدمات وعقارات مدينة العبور الجديدة', 'Your official portal for New Obour City services & real estate')}
          </p>
          {/* Real search: submitting navigates to /rationing?q=… and shows results there.
              `required` means it won't leave the homepage until the user types a query. */}
          {/* Oversized controls on purpose (golden rule) — same sizing family as the rationing SearchBar. */}
          <form action="/rationing" method="get" className="mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-xl">
            <span className="ps-2 text-gold" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            </span>
            <input
              name="q"
              required
              placeholder={L('ابحث عن اسمك في كشوف التقنين', 'Search the ledgers by your name…')}
              aria-label={L('ابحث عن اسمك في كشوف التقنين', 'Search the ledgers by your name')}
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-xl text-navy-800 outline-none placeholder:text-ink-400"
            />
            <button type="submit" className="flex-none rounded-xl bg-gold px-6 py-3 text-xl font-bold text-navy-900 transition hover:brightness-105">{L('بحث', 'Search')}</button>
          </form>
        </div>
      </section>

      {homeIntro && (
        <section className="mx-auto max-w-[1120px] px-6 pt-8">
          <SeoIntro text={homeIntro} />
        </section>
      )}

      {/* Recent listings — surfaced right below the hero */}
      {listings.length > 0 && (
        <section className="mx-auto max-w-[1120px] px-6 pt-10 pb-2">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold text-navy-800">{L('أحدث الإعلانات', 'Recent listings')}</h2>
            <a href="/market" className="text-sm font-bold text-accent hover:underline">{t('browse')} ›</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                href={marketHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null })}
                cover={cover.get(l.id) ?? null}
                title={l.title}
                subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
                price={isStoredPrice(l.price) ? Number(l.price).toLocaleString('en-US') : null}
                priceOnRequest={L('السعر عند الطلب', 'Price on request')}
                currency={currency(locale)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      <section className="mx-auto max-w-[1120px] px-6 py-14">
        <h2 className="mb-1 text-2xl font-extrabold text-navy-800">{L('الخدمات', 'Services')}</h2>
        <p className="mb-6 text-sm text-ink-500">{L('كل ما تحتاجه عن مدينتك في مكان واحد', 'Everything about your city in one place')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => {
            // Alternating accent tints (gold / navy / green) keep the grid lively but on-palette.
            const tint = [
              { chip: 'bg-gold-100 text-gold-700', hover: 'group-hover:bg-gold group-hover:text-navy-900' },
              { chip: 'bg-navy-50 text-navy-700', hover: 'group-hover:bg-navy-700 group-hover:text-white' },
              { chip: 'bg-emerald-50 text-emerald-700', hover: 'group-hover:bg-emerald-600 group-hover:text-white' },
            ][i % 3]!;
            return (
              <a key={s.href} href={s.href} className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-gold hover:shadow-xl">
                {/* soft gold glow sweeps in from the corner on hover */}
                <span aria-hidden className="pointer-events-none absolute -end-12 -top-12 h-32 w-32 rounded-full bg-gold/15 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
                <span className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${tint.chip} ${tint.hover} transition-all duration-200 group-hover:scale-110`}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                </span>
                <div className="text-xl font-extrabold text-navy-800">{s.title}</div>
                <div className="mt-1.5 min-h-10 text-sm leading-relaxed text-ink-500">{s.desc}</div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-gold-700 transition-all duration-200 group-hover:gap-3">
                  {L('ادخل الخدمة', 'Open service')}
                  <span aria-hidden>{L('←', '→')}</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

    </SiteShell>
  );
}
