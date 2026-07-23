import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { DeleteOfferButton } from './OfferActions';
import { OffersToolbar } from './OffersToolbar';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, readonly [string, string]> = { NEW: ['جديد', 'New'], REVIEWING: ['قيد المراجعة', 'Reviewing'], ACCEPTED: ['مقبول', 'Accepted'], REJECTED: ['مرفوض', 'Rejected'] };
const TONE: Record<string, string> = { NEW: 'bg-gold/20 text-graphite', REVIEWING: 'bg-info/15 text-info', ACCEPTED: 'bg-green/15 text-green', REJECTED: 'bg-graphite/10 opacity-70' };
const PER = 25;
const ORDER: Record<string, Prisma.LandOfferOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  price_desc: { requiredPrice: 'desc' },
  price_asc: { requiredPrice: 'asc' },
};

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('listings', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const sp = await searchParams;
  const get = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) ?? ''; };
  const q = get('q').trim();
  const status = STATUS[get('status')] ? get('status') : '';
  const sort = ORDER[get('sort')] ? get('sort') : 'newest';
  const page = Math.max(1, Number(get('page')) || 1);

  const where: Prisma.LandOfferWhereInput = {
    ...(status ? { status: status as Prisma.LandOfferWhereInput['status'] } : {}),
    ...(q ? { OR: [{ ownerName: { contains: q } }, { phone1: { contains: q } }] } : {}),
  };
  const [total, offers] = await Promise.all([
    prisma.landOffer.count({ where }),
    prisma.landOffer.findMany({
      where,
      orderBy: ORDER[sort],
      skip: (page - 1) * PER,
      take: PER,
      include: { city: { select: { name: true } }, district: { select: { nameAr: true } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (sort !== 'newest') p.set('sort', sort);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `?${s}` : '?';
  };

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(d);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('عروض البيع', 'Sale offers')} <span className="text-base font-normal opacity-60">({total})</span></h1>
        <a href="/admin/marketplace" className="text-sm text-accent">{L('← السوق', '← Marketplace')}</a>
      </div>

      <OffersToolbar total={total} />

      {offers.length === 0 ? (
        <p className="py-12 text-center opacity-60">{q || status ? L('لا توجد نتائج مطابقة', 'No matching results') : L('لا توجد عروض بعد', 'No offers yet')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="opacity-60">
              <tr>
                <th className="p-2 text-start">{L('النوع', 'Type')}</th>
                <th className="p-2 text-start">{L('المالك', 'Owner')}</th>
                <th className="p-2 text-start">{L('الهاتف', 'Phone')}</th>
                <th className="p-2 text-start">{L('المساحة', 'Area')}</th>
                <th className="p-2 text-start">{L('الموقع', 'Location')}</th>
                <th className="p-2 text-start">{L('السعر', 'Price')}</th>
                <th className="p-2 text-start">{L('الحالة', 'Status')}</th>
                <th className="p-2 text-start">{L('التاريخ', 'Date')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t border-graphite/10">
                  <td className="p-2">{o.mode === 'SHEET' ? L('كشف', 'Sheet') : L('تخصيص', 'Allocation')}</td>
                  <td className="p-2 font-medium">{o.ownerName}</td>
                  <td className="p-2" dir="ltr">{o.phone1}</td>
                  <td className="p-2">{o.area ? `${o.area} ${L('م²', 'm²')}` : '—'}</td>
                  <td className="p-2">{o.city?.name ?? o.district?.nameAr ?? '—'}</td>
                  <td className="p-2 font-num" dir="ltr">{o.requiredPrice != null ? Number(o.requiredPrice).toLocaleString('en') : '—'}</td>
                  <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${TONE[o.status] ?? ''}`}>{STATUS[o.status] ? L(...STATUS[o.status]!) : o.status}</span></td>
                  <td className="p-2" dir="ltr">{fmt(o.createdAt)}</td>
                  <td className="p-2 text-end">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/marketplace/offers/${o.id}`} className="text-accent">{L('عرض', 'View')}</Link>
                      <DeleteOfferButton id={o.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <a href={pageHref(page - 1)} className="rounded border border-graphite/20 px-3 py-1 text-accent">← {L('السابق', 'Prev')}</a>
          ) : (
            <span className="rounded border border-graphite/10 px-3 py-1 opacity-30">← {L('السابق', 'Prev')}</span>
          )}
          <span className="opacity-70">{L('صفحة', 'Page')} <b className="font-num">{page}</b> {L('من', 'of')} <b className="font-num">{totalPages}</b></span>
          {page < totalPages ? (
            <a href={pageHref(page + 1)} className="rounded border border-graphite/20 px-3 py-1 text-accent">{L('التالي', 'Next')} →</a>
          ) : (
            <span className="rounded border border-graphite/10 px-3 py-1 opacity-30">{L('التالي', 'Next')} →</span>
          )}
        </div>
      )}
    </div>
  );
}
