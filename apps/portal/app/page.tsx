import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PublicShell, ListingCard } from '@noc/ui';
import { currency } from '@noc/i18n';
import { getModuleVisibility } from '../lib/modules';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const tn = await getTranslations('nav');
  const tr = await getTranslations('rationing');
  const tl = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 4,
    include: { typeOption: true },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length
    ? await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } })
    : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);

  const vis = await getModuleVisibility();
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
    <PublicShell active="home">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-soft">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative mx-auto max-w-[1000px] px-6 py-20 text-center sm:py-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo" alt="" className="mx-auto mb-6 h-20 w-auto" />
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{tn('brand')}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-soft/80">
            {L('بوابتك الرسمية لخدمات وعقارات مدينة العبور الجديدة', 'Your official portal for New Obour City services & real estate')}
          </p>
          {/* Real search: submitting navigates to /rationing?q=… and shows results there.
              `required` means it won't leave the homepage until the user types a query. */}
          <form action="/rationing" method="get" className="mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-xl bg-white p-2 shadow-xl">
            <span className="ps-2 text-ink-400" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            </span>
            <input
              name="q"
              required
              placeholder={L('ابحث عن اسمك في كشوف التقنين', 'Search the ledgers by your name…')}
              aria-label={L('ابحث عن اسمك في كشوف التقنين', 'Search the ledgers by your name')}
              className="min-w-0 flex-1 bg-transparent px-1 text-navy-800 outline-none placeholder:text-ink-400"
            />
            <button type="submit" className="flex-none rounded-md bg-navy px-5 py-3 text-sm font-bold text-soft transition hover:brightness-110">{L('بحث', 'Search')}</button>
          </form>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-[1120px] px-6 py-16">
        <h2 className="mb-1 text-2xl font-extrabold text-navy-800">{L('الخدمات', 'Services')}</h2>
        <p className="mb-6 text-sm text-ink-500">{L('كل ما تحتاجه عن مدينتك في مكان واحد', 'Everything about your city in one place')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <a key={s.href} href={s.href} className="group rounded-lg border border-ink-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-gold hover:shadow-lg">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-gold-100 group-hover:text-gold-700">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
              </span>
              <div className="text-lg font-bold text-navy-800">{s.title}</div>
              <div className="mt-1 text-sm text-ink-500">{s.desc}</div>
            </a>
          ))}
        </div>
      </section>

      {/* Latest offers */}
      {listings.length > 0 && (
        <section className="mx-auto max-w-[1120px] px-6 pb-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold text-navy-800">{L('أحدث العروض', 'Latest offers')}</h2>
            <a href="/market" className="text-sm font-bold text-accent hover:underline">{t('browse')} →</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                href={`/market/${l.id}`}
                cover={cover.get(l.id) ?? null}
                title={l.title}
                subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
                price={l.price != null ? String(l.price) : null}
                currency={currency(locale)}
              />
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
