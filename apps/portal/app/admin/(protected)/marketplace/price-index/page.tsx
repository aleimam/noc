import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { computeDistrictPrices } from '../../../../../lib/priceIndex';
import { SnapshotNowButton } from './SnapshotNowButton';

export const dynamic = 'force-dynamic';

// Admin view of the price index: today's live per-district averages (what a snapshot would
// record) + the stored monthly snapshot history. The cron writes on the 1st of each month;
// "Snapshot now" overwrites the current month on demand.
export default async function AdminPriceIndexPage() {
  await requirePermission('marketplace', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const fmt = (n: number) => n.toLocaleString('en-US');

  const [live, snapshots] = await Promise.all([
    computeDistrictPrices(),
    prisma.priceSnapshot.findMany({
      orderBy: [{ month: 'desc' }, { avgPerM: 'desc' }],
      take: 240, // plenty: 6+ months × districts
      include: { district: { select: { nameAr: true, nameEn: true } } },
    }),
  ]);

  const byMonth = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const arr = byMonth.get(s.month) ?? [];
    arr.push(s);
    byMonth.set(s.month, arr);
  }

  const th = 'p-3 text-start text-xs font-semibold text-primary';
  const td = 'p-3';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">{L('مؤشر الأسعار', 'Price index')}</h1>
          <p className="mt-1 text-sm opacity-70">
            {L('يسجّل النظام لقطة شهرية تلقائيًا أول كل شهر؛ يمكنك تسجيل لقطة الشهر الحالي يدويًا في أي وقت.',
              'A snapshot is recorded automatically on the 1st of each month; you can re-record the current month manually at any time.')}
          </p>
        </div>
        <SnapshotNowButton locale={locale} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{L('الأسعار الحالية (المحسوبة الآن)', 'Live prices (computed now)')}</h2>
        {live.length === 0 ? (
          <p className="rounded-md border border-graphite/15 p-4 text-sm opacity-70">
            {L('لا توجد عروض أو قطع منشورة بسعر ومساحة وموقع بعد.', 'No published listings/plots with price, area and location yet.')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <thead className="bg-graphite/5">
                <tr>
                  <th className={th}>{L('الحي', 'District')}</th>
                  <th className={th}>{L('متوسط ج.م/م²', 'Avg EGP/m²')}</th>
                  <th className={th}>{L('العينات', 'Samples')}</th>
                  <th className={th}>{L('الحجم (ج.م)', 'Volume (EGP)')}</th>
                </tr>
              </thead>
              <tbody>
                {live.map((d) => (
                  <tr key={d.id} className="border-t border-graphite/10">
                    <td className={`${td} font-semibold`}>{L(d.nameAr, d.nameEn)}</td>
                    <td className={`${td} font-num`}>{fmt(d.avgPerM)}</td>
                    <td className={`${td} font-num`}>{fmt(d.count)}</td>
                    <td className={`${td} font-num`}>{fmt(d.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-primary">{L('اللقطات الشهرية المسجلة', 'Recorded monthly snapshots')}</h2>
        {byMonth.size === 0 ? (
          <p className="rounded-md border border-graphite/15 p-4 text-sm opacity-70">
            {L('لا توجد لقطات بعد — سجّل الأولى بزر «تسجيل لقطة الآن».', 'No snapshots yet — record the first with “Snapshot now”.')}
          </p>
        ) : (
          [...byMonth.entries()].map(([month, rows]) => (
            <details key={month} className="rounded-lg border border-graphite/15" open={month === [...byMonth.keys()][0]}>
              <summary className="cursor-pointer p-3 font-num font-semibold">{month} <span className="text-xs opacity-60">({rows.length} {L('حي', 'districts')})</span></summary>
              <div className="overflow-x-auto border-t border-graphite/10">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id} className="border-t border-graphite/10 first:border-t-0">
                        <td className={`${td} font-semibold`}>{L(s.district.nameAr, s.district.nameEn)}</td>
                        <td className={`${td} font-num`}>{fmt(s.avgPerM)} <span className="text-xs opacity-60">{L('ج.م/م²', 'EGP/m²')}</span></td>
                        <td className={`${td} font-num`}>{fmt(s.listingCount)} <span className="text-xs opacity-60">{L('عينة', 'samples')}</span></td>
                        <td className={`${td} font-num`}>{fmt(Number(s.volume))} <span className="text-xs opacity-60">{L('ج.م', 'EGP')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
