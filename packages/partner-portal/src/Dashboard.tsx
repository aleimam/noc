import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { PartnerListings, type PartnerRow } from './PartnerListings';
import { resolveListingAssets } from './listingAssets';

/** Partner dashboard: portfolio totals + the listings table with inline fast edit. Shared by
 *  both apps; each wraps it in its own brand shell (the (protected) layout). */
export async function PartnerDashboard() {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [listings, grantCount] = await Promise.all([
    prisma.listing.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, adNumber: true, status: true, price: true, soldPrice: true, views: true, rejectionReason: true,
        // Storefront eligibility: the Al Sawarey detail page 404s Types/Purposes not allowed there.
        typeOption: { select: { allowedOnAlsawarey: true } },
        purposeOption: { select: { allowedOnAlsawarey: true } },
      },
    }),
    prisma.ownerAllowedCategory.count({ where: { ownerId } }),
  ]);

  const count = (s: string) => listings.filter((l) => l.status === s).length;
  const soldValue = listings
    .filter((l) => l.status === 'SOLD')
    .reduce((a, l) => a + Number(l.soldPrice ?? l.price ?? 0), 0);
  const totalViews = listings.reduce((a, l) => a + l.views, 0);
  const fmt = (n: number) => n.toLocaleString('en-US');

  const stats = [
    { label: L('إعلانات متاحة', 'Available'), value: fmt(count('PUBLISHED')), tone: 'text-green' },
    { label: L('قيد المراجعة', 'In review'), value: fmt(count('PENDING')), tone: 'text-amber-600' },
    { label: L('تم بيعها', 'Sold'), value: fmt(count('SOLD')), tone: 'text-navy-800' },
    { label: L('قيمة المبيعات', 'Sales value'), value: `${fmt(soldValue)} ${L('ج.م', 'EGP')}`, tone: 'text-navy-800' },
    { label: L('المشاهدات', 'Views'), value: fmt(totalViews), tone: 'text-navy-800' },
  ];

  // On alsawarey the public detail page only serves Types/Purposes flagged allowedOnAlsawarey —
  // pointing the «عرض في السوق» button at anything else would 404. The portal shows everything.
  const onAlsawarey = process.env.NOC_SITE === 'alsawarey';
  // Partners get the UNBRANDED poster + clean map (owner-display rule) — theirs to reuse.
  const assets = await resolveListingAssets(listings.map((l) => l.id), { branded: false });
  const rows: PartnerRow[] = listings.map((l) => ({
    id: l.id,
    title: l.title,
    adNumber: l.adNumber,
    status: l.status,
    price: l.price != null ? String(l.price) : '',
    views: l.views,
    rejectionReason: l.rejectionReason,
    publicOk: !onAlsawarey || (!!l.typeOption?.allowedOnAlsawarey && !!l.purposeOption?.allowedOnAlsawarey),
    posterUrl: assets.get(l.id)?.posterUrl ?? null,
    mapUrl: assets.get(l.id)?.mapUrl ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-ink-200 bg-white p-4 text-center shadow-sm">
            <div className={`font-num text-2xl font-black ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-ink-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-navy-800 dark:text-soft">{L('إعلاناتي', 'My listings')}</h1>
        {grantCount > 0 && (
          <a href="/partner/listings/new" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-soft">
            + {L('إضافة إعلان', 'Add listing')}
          </a>
        )}
      </div>
      {/* NOC_SITE is the server-trusted brand identity — it decides which public path the
          «عرض في السوق» button opens ('/listings' on alsawarey.com, '/market' on newobour.com). */}
      <PartnerListings rows={rows} locale={locale} publicBase={onAlsawarey ? '/listings' : '/market'} />
    </div>
  );
}
