import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { Prisma } from '@noc/db';
import { auth } from '@noc/auth';
import { StoreShell } from '../_components/StoreShell';
import { StoreLandCard } from '../_components/StoreLandCard';
import { listLands, wishlistIds, ATTR } from '../../lib/listings';

export const dynamic = 'force-dynamic';

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
  const corner = str(sp.corner) === '1';
  const main = str(sp.main) === '1';
  const services = str(sp.services) === '1';
  const statusSold = str(sp.status) === 'sold';
  const sort = str(sp.sort);
  const page = Math.max(1, num(sp.page) ?? 1);

  const and: Prisma.ListingWhereInput[] = [];
  if (q) and.push({ title: { contains: q } });
  if (area != null) and.push(attr(ATTR.area, { number: area }));
  else if (areaMin != null || areaMax != null) {
    and.push(attr(ATTR.area, { number: { ...(areaMin != null ? { gte: areaMin } : {}), ...(areaMax != null ? { lte: areaMax } : {}) } }));
  }
  if (corner) and.push(attr(ATTR.corner, { bool: true }));
  if (main) and.push(attr(ATTR.mainStreet, { bool: true }));
  if (services) and.push(attr('electricity', { option: { key: 'connected' } }));
  if (statusSold) and.push({ status: 'SOLD' });

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    sort === 'price_asc' ? [{ price: 'asc' }] : sort === 'price_desc' ? [{ price: 'desc' }] : [{ status: 'asc' }, { publishedAt: 'desc' }];

  const session = await auth();
  const [{ cards, total }, wished] = await Promise.all([
    listLands({ where: and.length ? { AND: and } : {}, orderBy, take: PAGE, skip: (page - 1) * PAGE }),
    wishlistIds(session?.user?.id),
  ]);
  const totalPages = Math.ceil(total / PAGE);

  // preserve current filters across sort/pagination links
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'page') baseParams.set(k, v);
  const withParam = (k: string, val: string) => {
    const p = new URLSearchParams(baseParams);
    p.set(k, val);
    return `/listings?${p.toString()}`;
  };

  const chip = 'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm hover:border-gold';
  const chipOn = 'rounded-lg border-2 border-gold bg-gold-50 px-3 py-1.5 text-sm font-bold text-gold-800';
  const noFilters = !corner && !main && !services && area == null && areaMin == null && areaMax == null && !statusSold;

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-black text-navy-800">{L('الأراضي المتاحة', 'Available lands')}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href="/listings" className={noFilters ? chipOn : chip}>{L('الكل', 'All')}</Link>
          <Link href={withParam('corner', '1')} className={corner ? chipOn : chip}>{L('ناصية', 'Corner')}</Link>
          <Link href={withParam('main', '1')} className={main ? chipOn : chip}>{L('شارع رئيسي', 'Main road')}</Link>
          <Link href={withParam('services', '1')} className={services ? chipOn : chip}>{L('بالمرافق', 'Services')}</Link>
          {[209, 276, 350, 400, 450, 500].map((a) => (
            <Link key={a} href={withParam('area', String(a))} className={area === a ? chipOn : chip}>{a} {L('م²', 'm²')}</Link>
          ))}
          <Link href={withParam('status', 'sold')} className={statusSold ? chipOn : chip}>{L('المباعة', 'Sold')}</Link>
        </div>

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
            {cards.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted={wished.has(land.id)} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm">
            {page > 1 && <Link href={withParam('page', String(page - 1))} className={chip}>{L('السابق', 'Prev')}</Link>}
            <span className="text-ink-500">{L(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
            {page < totalPages && <Link href={withParam('page', String(page + 1))} className={chip}>{L('التالي', 'Next')}</Link>}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
