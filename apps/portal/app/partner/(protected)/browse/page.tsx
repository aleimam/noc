import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { formatMoneyEgp, formatArea } from '@noc/config';
import { partnerCanBrowseListings } from '@noc/partner-portal/server';

export const dynamic = 'force-dynamic';

/** Partner-portal, view-only: browse all our published sell offers. Gated by the global
 *  switch + the partner's own flag; each card links to the public listing detail. */
export default async function PartnerBrowsePage() {
  const { ownerId } = await requirePartner();
  if (!(await partnerCanBrowseListings(ownerId))) notFound();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
    select: {
      id: true, title: true, adNumber: true, area: true, price: true, priceUnit: true,
      typeOption: { select: { nameAr: true, nameEn: true } },
      neighborhood: { select: { nameAr: true, nameEn: true, district: { select: { nameAr: true, nameEn: true } } } },
    },
  });

  // Unbranded poster thumbnails only (never the branded posters) as card covers.
  const covers = listings.length
    ? new Map(
        (await prisma.attachment.findMany({
          where: { ownerType: 'ListingPoster', ownerId: { in: listings.map((l) => l.id) }, stampCategory: 'poster:unbranded' },
          select: { ownerId: true, path: true },
        })).map((a) => [a.ownerId, a.path]),
      )
    : new Map<string, string>();

  const perLabel = (u: string) => (u === 'UNIT' ? L('للوحدة', 'per unit') : u === 'SQM' ? L('للمتر', 'per m²') : '');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-navy-800">{L('جميع العروض', 'All offers')}</h1>
        <p className="mt-1 text-sm text-ink-500">{L('تصفّح كل عروضنا المنشورة — للاطّلاع فقط.', 'Browse all our published offers — view only.')} ({listings.length})</p>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-center text-ink-500">{L('لا توجد عروض منشورة حالياً.', 'No published offers yet.')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const loc = [l.neighborhood?.district?.[locale === 'ar' ? 'nameAr' : 'nameEn'], l.neighborhood?.[locale === 'ar' ? 'nameAr' : 'nameEn']].filter(Boolean).join(' — ');
            const cover = covers.get(l.id);
            return (
              <a key={l.id} href={`/partner/browse/${l.id}`} className="flex flex-col rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition hover:border-gold-400 hover:shadow-md">
                {cover && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={cover} alt="" className="mb-3 h-40 w-full rounded-lg object-cover object-top" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-navy-800">{l.title}</h2>
                  {l.adNumber && <span className="shrink-0 font-num text-xs text-ink-400" dir="ltr">#{l.adNumber}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-600">
                  {l.typeOption && <span>{L(l.typeOption.nameAr, l.typeOption.nameEn)}</span>}
                  {l.area != null && <span className="font-num">{formatArea(Number(l.area), locale)}</span>}
                </div>
                {loc && <div className="mt-1 text-sm text-ink-500">📍 {loc}</div>}
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="font-num font-bold text-navy-800">
                    {l.price != null ? `${formatMoneyEgp(Number(l.price), locale)}${perLabel(l.priceUnit) ? ` / ${perLabel(l.priceUnit)}` : ''}` : L('السعر عند الطلب', 'Price on request')}
                  </span>
                  <span className="text-sm font-semibold text-gold-700">{L('عرض التفاصيل ←', 'View details ←')}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
