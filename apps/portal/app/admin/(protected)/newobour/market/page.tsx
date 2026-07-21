import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { DeleteListingButton } from './DeleteListingButton';
import { ApproveListingButton } from './ApproveListingButton';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: 'bg-green/15 text-green',
  PENDING: 'bg-gold/20 text-graphite',
  REJECTED: 'bg-red-100 text-red-700',
  SOLD: 'bg-navy/10 text-primary',
  DRAFT: 'bg-graphite/10 text-graphite',
  ARCHIVED: 'bg-graphite/10 text-graphite',
};

// New Obour's own marketplace surface. Listings are shared with Al Sawarey (a listing
// shows on Al Sawarey only when showOnBrokerage is on); this section is the New-Obour-
// branded entry point for adding/managing them.
export default async function NewObourMarket() {
  await requirePermission('listings', 'VIEW');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  const listings = await prisma.listing.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    select: { id: true, title: true, status: true, price: true, showOnBrokerage: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">{L('سوق العبور الجديدة', 'New Obour market')}</h1>
          <p className="text-sm opacity-70">{L('أضف وأدر عروض السوق. العرض يظهر على الصواري فقط عند تفعيل خيار النشر.', 'Add & manage market listings. A listing shows on Al Sawarey only when its publish toggle is on.')}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/marketplace/listings/deleted" className="text-sm opacity-70 hover:opacity-100">🗑️ {L('المحذوفات', 'Trash')}</a>
          <a href="/admin/newobour/market/new" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft">+ {L('إضافة عرض جديد', 'Add listing')}</a>
        </div>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-8 text-center text-sm opacity-60">{L('لا توجد إعلانات بعد', 'No listings yet')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-graphite/5 text-start">
              <tr>
                <th className="p-2 text-start">{t('listingTitle')}</th>
                <th className="p-2 text-start">{t('price')}</th>
                <th className="p-2 text-start">{t('active')}</th>
                <th className="p-2 text-start">{L('على الصواري', 'On Al Sawarey')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">{l.title}</td>
                  <td className="p-2 font-num" dir="ltr">{l.price != null ? `${String(l.price)} ${currency(locale)}` : '—'}</td>
                  <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLOR[l.status] ?? ''}`}>{t(`status${l.status}`)}</span></td>
                  <td className="p-2">{l.showOnBrokerage ? '✔' : '—'}</td>
                  <td className="p-2 text-end">
                    <span className="inline-flex items-center gap-3">
                      {/* One-click approve for pending rows only — published/rejected/etc. don't need it. */}
                      {l.status === 'PENDING' && <ApproveListingButton id={l.id} />}
                      <a href={`/admin/marketplace/listings/${l.id}/edit`} className="text-accent hover:underline">{t('edit')}</a>
                      <DeleteListingButton id={l.id} title={l.title} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <a href="/admin/marketplace/listings" className="inline-block text-sm text-accent">{L('فتح الإدارة الكاملة (الصواري) ←', 'Open full manager (Al Sawarey) →')}</a>
    </div>
  );
}
