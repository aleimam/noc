import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DeleteOfferButton } from './OfferActions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = { NEW: 'جديد', REVIEWING: 'قيد المراجعة', ACCEPTED: 'مقبول', REJECTED: 'مرفوض' };
const TONE: Record<string, string> = { NEW: 'bg-gold/20 text-graphite', REVIEWING: 'bg-info/15 text-info', ACCEPTED: 'bg-green/15 text-green', REJECTED: 'bg-graphite/10 opacity-70' };

export default async function OffersPage() {
  await requirePermission('listings', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const offers = await prisma.landOffer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { city: { select: { name: true } }, district: { select: { nameAr: true } } },
  });

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(d);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">عروض البيع <span className="text-base font-normal opacity-60">({offers.length})</span></h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← السوق</a>
      </div>

      {offers.length === 0 ? (
        <p className="py-12 text-center opacity-60">لا توجد عروض بعد</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="opacity-60">
              <tr>
                <th className="p-2 text-start">النوع</th>
                <th className="p-2 text-start">المالك</th>
                <th className="p-2 text-start">الهاتف</th>
                <th className="p-2 text-start">المساحة</th>
                <th className="p-2 text-start">الموقع</th>
                <th className="p-2 text-start">السعر</th>
                <th className="p-2 text-start">الحالة</th>
                <th className="p-2 text-start">التاريخ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t border-graphite/10">
                  <td className="p-2">{o.mode === 'SHEET' ? 'كشف' : 'تخصيص'}</td>
                  <td className="p-2 font-medium">{o.ownerName}</td>
                  <td className="p-2" dir="ltr">{o.phone1}</td>
                  <td className="p-2">{o.area ? `${o.area} م²` : '—'}</td>
                  <td className="p-2">{o.city?.name ?? o.district?.nameAr ?? '—'}</td>
                  <td className="p-2 font-num" dir="ltr">{o.requiredPrice != null ? Number(o.requiredPrice).toLocaleString('en') : '—'}</td>
                  <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${TONE[o.status] ?? ''}`}>{STATUS[o.status]}</span></td>
                  <td className="p-2" dir="ltr">{fmt(o.createdAt)}</td>
                  <td className="p-2 text-end">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/marketplace/offers/${o.id}`} className="text-accent">عرض</Link>
                      <DeleteOfferButton id={o.id} />
                    </div>
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
