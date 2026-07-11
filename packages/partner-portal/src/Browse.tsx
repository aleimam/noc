import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { formatMoneyEgp, formatArea } from '@noc/config';
import { partnerCanBrowseListings } from './partner';

/** Partner-portal, view-only: browse all our published sell offers. Gated by the global switch
 *  + the partner's own flag; each card links to the partner listing detail. Shared by both apps. */
export async function PartnerBrowse() {
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
        <h1 className="text-2xl font-black text-navy-800 dark:text-soft">{L('جميع العروض', 'All offers')}</h1>
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
                  <span className="text-sm font-semibold text-gold-700">{L('عرض التفاصيل ←', 'View details →')}</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Partner-portal listing view (view-only): UNBRANDED assets only — the unbranded generated
 *  poster + the owner's raw uploaded photos — never the branded posters. No owner contact. */
export async function PartnerBrowseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ownerId } = await requirePartner();
  if (!(await partnerCanBrowseListings(ownerId))) notFound();
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listing = await prisma.listing.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      id: true, title: true, adNumber: true, area: true, price: true, priceUnit: true,
      hasAllocationLetter: true, hasSaleMandate: true,
      typeOption: { select: { nameAr: true, nameEn: true } },
      neighborhood: { select: { nameAr: true, nameEn: true, district: { select: { nameAr: true, nameEn: true } } } },
    },
  });
  if (!listing) notFound();

  const [posterRow, photos] = await Promise.all([
    prisma.attachment.findFirst({ where: { ownerType: 'ListingPoster', ownerId: id, stampCategory: 'poster:unbranded' }, select: { path: true } }),
    prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: id, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, path: true } }),
  ]);
  const poster = posterRow?.path ?? null;

  const nm = (o: { nameAr: string; nameEn: string } | null | undefined) => (o ? L(o.nameAr, o.nameEn) : '');
  const loc = [nm(listing.neighborhood?.district), nm(listing.neighborhood)].filter(Boolean).join(' — ');
  const perLabel = listing.priceUnit === 'UNIT' ? L('للوحدة', 'per unit') : listing.priceUnit === 'SQM' ? L('للمتر', 'per m²') : '';

  return (
    <div className="space-y-5">
      <a href="/partner/browse" className="text-sm font-semibold text-gold-700">{L('→ كل العروض', '← All offers')}</a>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-black text-navy-800">{listing.title}</h1>
          {listing.adNumber && <span className="shrink-0 font-num text-sm text-ink-400" dir="ltr">#{listing.adNumber}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
          {listing.typeOption && <span>{nm(listing.typeOption)}</span>}
          {listing.area != null && <span className="font-num">{formatArea(Number(listing.area), locale)}</span>}
          {loc && <span>📍 {loc}</span>}
        </div>
        <div className="mt-3 font-num text-lg font-bold text-navy-800">
          {listing.price != null ? `${formatMoneyEgp(Number(listing.price), locale)}${perLabel ? ` / ${perLabel}` : ''}` : L('السعر عند الطلب', 'Price on request')}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
          {[
            { label: L('جواب التحصيص', 'Allocation letter'), has: listing.hasAllocationLetter },
            { label: L('توكيل بيع', 'Sale mandate'), has: listing.hasSaleMandate },
          ].map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-ink-100 px-3 py-1 text-xs">
              <span className="font-semibold text-ink-600">{p.label}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${p.has ? 'bg-success/15 text-success' : 'bg-ink-100 text-ink-500'}`}>
                {p.has ? L('متوفر', 'Available') : L('غير متوفر', 'Not available')}
              </span>
            </span>
          ))}
        </div>
      </div>

      {poster && (
        <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-sm">
          <h2 className="mb-2 px-1 text-sm font-bold text-ink-500">{L('بطاقة التفاصيل', 'Details card')}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt={listing.title} className="mx-auto w-full max-w-lg rounded-lg" />
        </div>
      )}

      {photos.length > 0 && (
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-ink-500">{L('الصور', 'Photos')} ({photos.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <a key={p.id} href={p.path} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.path} alt="" className="aspect-square w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        </div>
      )}

      {!poster && photos.length === 0 && (
        <p className="rounded-lg border border-ink-100 p-6 text-center text-ink-500">{L('لا توجد صور متاحة لهذا العرض.', 'No images available for this offer.')}</p>
      )}
    </div>
  );
}
