import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { formatMoneyEgp, formatArea } from '@noc/config';
import { partnerCanBrowseListings } from '@noc/partner-portal/server';

export const dynamic = 'force-dynamic';

/** Partner-portal listing view (view-only). Partners see UNBRANDED assets only — the
 *  unbranded generated poster (carries all the details) + the owner's raw uploaded
 *  photos — never the New Obour / Al Sawarey branded posters. No owner contact. */
export default async function PartnerListingDetail({ params }: { params: Promise<{ id: string }> }) {
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

  // Unbranded assets only: the unbranded poster + the owner's raw uploaded photos.
  const [posterRow, photos] = await Promise.all([
    prisma.attachment.findFirst({
      where: { ownerType: 'ListingPoster', ownerId: id, stampCategory: 'poster:unbranded' },
      select: { path: true },
    }),
    prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: id, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, path: true },
    }),
  ]);
  const poster = posterRow?.path ?? null;

  const nm = (o: { nameAr: string; nameEn: string } | null | undefined) => (o ? L(o.nameAr, o.nameEn) : '');
  const loc = [nm(listing.neighborhood?.district), nm(listing.neighborhood)].filter(Boolean).join(' — ');
  const perLabel = listing.priceUnit === 'UNIT' ? L('للوحدة', 'per unit') : listing.priceUnit === 'SQM' ? L('للمتر', 'per m²') : '';

  return (
    <div className="space-y-5">
      <a href="/partner/browse" className="text-sm font-semibold text-gold-700">← {L('كل العروض', 'All offers')}</a>

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
          {listing.price != null
            ? `${formatMoneyEgp(Number(listing.price), locale)}${perLabel ? ` / ${perLabel}` : ''}`
            : L('السعر عند الطلب', 'Price on request')}
        </div>

        {/* Official papers — partners see the status of each paper only. */}
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

      {/* The unbranded poster carries the full details (area, groups, maps) with no brand. */}
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
