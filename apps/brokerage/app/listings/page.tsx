import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { Prisma, prisma } from '@noc/db';
import { StoreShell } from '../_components/StoreShell';
import { RecentlyViewed } from '@noc/ui';
import { StoreLandCard } from '../_components/StoreLandCard';
import { listLands, ATTR } from '../../lib/listings';
import { getAdminViewer, ownerBadges } from '../../lib/adminView';
import { wishlistListingIds } from '../../lib/wishlist';
import { pageMeta } from '../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Lands for sale — Al Sawarey' : 'أراضٍ للبيع — الصواري',
    description: locale === 'en' ? 'Selected lands for sale in New Obour City and beyond — filter by area, price, district and features.' : 'أراضٍ مختارة للبيع في مدينة العبور الجديدة وما حولها — فلترة بالمساحة والسعر والمنطقة والمميزات.',
    path: '/listings',
    locale,
  });
}

const PAGE = 24;
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '').trim();
const num = (v: string | string[] | undefined) => {
  const n = parseInt(str(v), 10);
  return isNaN(n) ? null : n;
};

/** Build a ListingValue `some` condition for one attribute key. */
function attr(key: string, cond: Prisma.ListingValueWhereInput): Prisma.ListingWhereInput {
  return { values: { some: { attribute: { key }, ...cond } } };
}

export default async function Catalogue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const q = str(sp.q);
  const area = num(sp.area);
  const areaMin = num(sp.areaMin);
  const areaMax = num(sp.areaMax);
  const priceMin = num(sp.priceMin);
  const priceMax = num(sp.priceMax);
  const corner = str(sp.corner) === '1';
  const main = str(sp.main) === '1';
  const services = str(sp.services) === '1';
  const garden = str(sp.view) === 'garden';
  const featured = str(sp.featured) === '1';
  const statusSold = str(sp.status) === 'sold';
  const sort = str(sp.sort);
  const page = Math.max(1, num(sp.page) ?? 1);

  const and: Prisma.ListingWhereInput[] = [];
  // Posters print the ad number — let people search by it, not just the title.
  if (q) and.push({ OR: [{ title: { contains: q } }, { adNumber: { contains: q } }] });
  if (area != null) and.push(attr(ATTR.area, { number: area }));
  else if (areaMin != null || areaMax != null) {
    and.push(attr(ATTR.area, { number: { ...(areaMin != null ? { gte: areaMin } : {}), ...(areaMax != null ? { lte: areaMax } : {}) } }));
  }
  if (priceMin != null || priceMax != null) {
    and.push({ price: { ...(priceMin != null ? { gte: priceMin } : {}), ...(priceMax != null ? { lte: priceMax } : {}) } });
  }

  // Dynamic range filters for every filterable numeric/money/area detail.
  const rangeAttrs = await prisma.attribute.findMany({
    where: { isActive: true, filterable: true, type: { in: ['NUMBER', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED'] } },
    orderBy: { order: 'asc' },
    select: { key: true, labelAr: true, labelEn: true, unit: true },
  });
  for (const fa of rangeAttrs) {
    const mn = num(sp[`fmin_${fa.key}`]);
    const mx = num(sp[`fmax_${fa.key}`]);
    if (mn != null || mx != null) {
      and.push(attr(fa.key, { number: { ...(mn != null ? { gte: mn } : {}), ...(mx != null ? { lte: mx } : {}) } }));
    }
  }
  if (corner) and.push(attr(ATTR.corner, { bool: true }));
  if (main) and.push(attr(ATTR.mainStreet, { bool: true }));
  if (services) and.push(attr('electricity', { option: { key: 'connected' } }));
  // "على حديقة" banner/pill (?view=garden): lands near a park via the near_landmark multi-select.
  if (garden) and.push(attr('near_landmark', { option: { key: 'park' } }));
  if (featured) and.push({ featured: true });
  if (statusSold) and.push({ status: 'SOLD' });

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    sort === 'price_asc' ? [{ price: 'asc' }] : sort === 'price_desc' ? [{ price: 'desc' }] : [{ status: 'asc' }, { publishedAt: 'desc' }];

  const [{ cards, total }, wished] = await Promise.all([
    listLands({ where: and.length ? { AND: and } : {}, orderBy, take: PAGE, skip: (page - 1) * PAGE }),
    wishlistListingIds(),
  ]);
  const totalPages = Math.ceil(total / PAGE);
  // Staff admin view: owner badge on each card.
  const owners = (await getAdminViewer()) ? await ownerBadges(cards.map((c) => c.id)) : null;

  // preserve current filters across sort/pagination links
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'page') baseParams.set(k, v);
  const withParam = (k: string, val: string) => {
    const p = new URLSearchParams(baseParams);
    p.set(k, val);
    return `/listings?${p.toString()}`;
  };

  // Explicit text colors on the white chips/panels so dark mode can't render white-on-white.
  const chip = 'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-navy-800 hover:border-gold';
  const chipOn = 'rounded-lg border-2 border-gold bg-gold-50 px-3 py-1.5 text-sm font-bold text-gold-800';
  const rangeActive = rangeAttrs.some((fa) => str(sp[`fmin_${fa.key}`]) || str(sp[`fmax_${fa.key}`]));
  const noFilters = !corner && !main && !services && !garden && !featured && area == null && areaMin == null && areaMax == null && priceMin == null && priceMax == null && !statusSold && !rangeActive;

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-black text-navy-800 dark:text-soft">{L('الأراضي المتاحة', 'Available lands')}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/listings" className={noFilters ? chipOn : chip}>{L('الكل', 'All')}</Link>
          <Link href={withParam('featured', '1')} className={featured ? chipOn : chip}>★ {L('مميز', 'Featured')}</Link>
          <Link href={withParam('corner', '1')} className={corner ? chipOn : chip}>{L('ناصية', 'Corner')}</Link>
          <Link href={withParam('main', '1')} className={main ? chipOn : chip}>{L('شارع رئيسي', 'Main road')}</Link>
          <Link href={withParam('services', '1')} className={services ? chipOn : chip}>{L('بالمرافق', 'Services')}</Link>
          <Link href={withParam('view', 'garden')} className={garden ? chipOn : chip}>{L('على حديقة', 'Garden')}</Link>
          {[209, 276, 350, 400, 450, 500].map((a) => (
            <Link key={a} href={withParam('area', String(a))} className={area === a ? chipOn : chip}>{a} {L('م²', 'm²')}</Link>
          ))}
          <Link href={withParam('status', 'sold')} className={statusSold ? chipOn : chip}>{L('المباعة', 'Sold')}</Link>
        </div>

        {/* Price + spec range filters (GET form; preserves the active chips above) */}
        <details
          className="mt-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-navy-800"
          open={priceMin != null || priceMax != null || rangeAttrs.some((fa) => str(sp[`fmin_${fa.key}`]) || str(sp[`fmax_${fa.key}`]))}
        >
          <summary className="cursor-pointer text-sm font-bold text-navy-800">{L('فلترة بالسعر والمواصفات', 'Filter by price & specs')}</summary>
          <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q && <input type="hidden" name="q" value={q} />}
            {corner && <input type="hidden" name="corner" value="1" />}
            {main && <input type="hidden" name="main" value="1" />}
            {services && <input type="hidden" name="services" value="1" />}
            {garden && <input type="hidden" name="view" value="garden" />}
            {featured && <input type="hidden" name="featured" value="1" />}
            {statusSold && <input type="hidden" name="status" value="sold" />}
            {area != null && <input type="hidden" name="area" value={String(area)} />}
            {sort && <input type="hidden" name="sort" value={sort} />}

            <div className="text-sm">
              <span className="mb-1 block">{L('السعر (ج.م)', 'Price (EGP)')}</span>
              <div className="flex gap-2">
                <input name="priceMin" type="number" inputMode="numeric" dir="ltr" defaultValue={priceMin ?? ''} placeholder={L('من', 'Min')} className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" />
                <input name="priceMax" type="number" inputMode="numeric" dir="ltr" defaultValue={priceMax ?? ''} placeholder={L('إلى', 'Max')} className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" />
              </div>
            </div>

            {rangeAttrs.map((fa) => (
              <div key={fa.key} className="text-sm">
                <span className="mb-1 block">{L(fa.labelAr, fa.labelEn)}{fa.unit ? ` (${fa.unit})` : ''}</span>
                <div className="flex gap-2">
                  <input name={`fmin_${fa.key}`} type="number" inputMode="numeric" dir="ltr" defaultValue={str(sp[`fmin_${fa.key}`])} placeholder={L('من', 'Min')} className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" />
                  <input name={`fmax_${fa.key}`} type="number" inputMode="numeric" dir="ltr" defaultValue={str(sp[`fmax_${fa.key}`])} placeholder={L('إلى', 'Max')} className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm" />
                </div>
              </div>
            ))}

            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-lg bg-navy px-5 py-2 text-sm font-bold text-white">{L('تطبيق', 'Apply')}</button>
              <a href="/listings" className="rounded-lg border border-ink-200 px-4 py-2 text-sm">{L('مسح', 'Clear')}</a>
            </div>
          </form>
        </details>

        <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
          <span>{L(`${total} نتيجة`, `${total} results`)}</span>
          <div className="flex items-center gap-3">
            <span>{L('ترتيب:', 'Sort:')}</span>
            <Link href={withParam('sort', 'price_asc')} className={sort === 'price_asc' ? 'font-bold text-gold-700' : 'text-navy-600'}>{L('الأقل سعراً', 'Price ↑')}</Link>
            <Link href={withParam('sort', 'price_desc')} className={sort === 'price_desc' ? 'font-bold text-gold-700' : 'text-navy-600'}>{L('الأعلى سعراً', 'Price ↓')}</Link>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="py-16 text-center text-ink-500">{L('لا توجد نتائج مطابقة', 'No matching lands')}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} owner={owners?.get(land.id)} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 && <Link href={withParam('page', String(page - 1))} className={chip}>{L('السابق', 'Prev')}</Link>}
            <span className="text-ink-500">{L(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
            {page < totalPages && <Link href={withParam('page', String(page + 1))} className={chip}>{L('التالي', 'Next')}</Link>}
          </div>
        )}

        <div className="mt-10"><RecentlyViewed title={L('شوهدت مؤخرًا', 'Recently viewed')} /></div>
      </div>
    </StoreShell>
  );
}
