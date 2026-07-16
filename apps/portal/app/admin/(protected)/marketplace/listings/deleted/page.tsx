import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { DeletedRowActions } from './DeletedRowActions';

export const dynamic = 'force-dynamic';

const PURGE_DAYS = 90;

/** Admin trash: soft-deleted listings, kept 90 days then purged by the nightly cron.
 *  Gated on listings:DELETE — only roles allowed to delete can see (or restore) the trash. */
export default async function DeletedListings() {
  await requirePermission('listings', 'DELETE');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  const listings = await prisma.listing.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select: { id: true, title: true, status: true, price: true, adNumber: true, deletedAt: true },
  });
  const fmtDate = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const daysLeft = (d: Date) => Math.max(0, PURGE_DAYS - Math.floor((Date.now() - d.getTime()) / 86_400_000));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">🗑️ {L('العروض المحذوفة', 'Deleted listings')}</h1>
          <p className="text-sm opacity-70">
            {L(
              `المحذوفات تبقى هنا ${PURGE_DAYS} يوماً ويمكن استرجاعها، ثم تُحذف نهائياً تلقائياً.`,
              `Deleted listings stay here for ${PURGE_DAYS} days and can be restored, then they are purged automatically.`,
            )}
          </p>
        </div>
        <a href="/admin/marketplace/listings" className="text-sm text-accent">← {t('title')}</a>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-8 text-center text-sm opacity-60">{L('سلة المحذوفات فارغة', 'The trash is empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-graphite/5">
              <tr>
                <th className="p-2 text-start">{t('listingTitle')}</th>
                <th className="p-2 text-start">{t('price')}</th>
                <th className="p-2 text-start">{L('حُذف في', 'Deleted on')}</th>
                <th className="p-2 text-start">{L('الحذف النهائي بعد', 'Purged in')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">
                    {l.title}
                    {l.adNumber && <span className="font-num ms-2 text-xs opacity-50" dir="ltr">#{l.adNumber}</span>}
                  </td>
                  <td className="p-2 font-num" dir="ltr">{l.price != null ? `${String(l.price)} ${currency(locale)}` : '—'}</td>
                  <td className="p-2" dir="ltr">{l.deletedAt ? fmtDate(l.deletedAt) : '—'}</td>
                  <td className="p-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${daysLeft(l.deletedAt!) <= 7 ? 'bg-red-100 text-red-700' : 'bg-graphite/10'}`}>
                      {L(`${daysLeft(l.deletedAt!)} يوم`, `${daysLeft(l.deletedAt!)} days`)}
                    </span>
                  </td>
                  <td className="p-2 text-end">
                    <DeletedRowActions id={l.id} title={l.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
