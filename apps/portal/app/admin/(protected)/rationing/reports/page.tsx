import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ReportRowActions } from './ReportRowActions';

export const dynamic = 'force-dynamic';

// Visitor reports of rationing sheets missing from the digitized register.
export default async function MissedSheetReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('sheets', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const sp = await searchParams;
  const showDone = (typeof sp.done === 'string' ? sp.done : '') === '1';

  const reports = await prisma.missedSheetReport.findMany({
    where: showDone ? {} : { status: 'NEW' },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { city: { select: { name: true } } },
  });
  const ids = reports.map((r) => r.id);
  const photos = ids.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'MissedSheetReport', ownerId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const photosBy = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.ownerId) continue;
    (photosBy.get(p.ownerId) ?? photosBy.set(p.ownerId, []).get(p.ownerId)!).push(p.path);
  }
  const newCount = await prisma.missedSheetReport.count({ where: { status: 'NEW' } });

  const fmt = (d: Date | null) =>
    d ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          بلاغات كشوف ناقصة <span className="text-base font-normal opacity-60">({newCount} جديد)</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← التقنين</a>
      </div>

      <div className="flex gap-2 text-sm">
        <a href="/admin/rationing/reports" className={`rounded-md px-3 py-1.5 ${!showDone ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>الجديدة</a>
        <a href="/admin/rationing/reports?done=1" className={`rounded-md px-3 py-1.5 ${showDone ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>الكل</a>
      </div>

      {reports.length === 0 ? (
        <p className="py-12 text-center opacity-60">لا توجد بلاغات{showDone ? '' : ' جديدة'}.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">التاريخ</th>
                <th className="p-2 text-start">المُبلِّغ</th>
                <th className="p-2 text-start">الهاتف</th>
                <th className="p-2 text-start">نشر فيسبوك</th>
                <th className="p-2 text-start">الجمعية</th>
                <th className="p-2 text-start">المالك الأصلي</th>
                <th className="p-2 text-start">البلوك</th>
                <th className="p-2 text-start">القطعة</th>
                <th className="p-2 text-start">الصور</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className={`border-t border-graphite/10 ${r.status === 'DONE' ? 'opacity-50' : ''}`}>
                  <td className="p-2" dir="ltr">{fmt(r.createdAt)}</td>
                  <td className="p-2 font-medium">
                    {r.reporterName}
                    {r.userId && <span className="ms-1.5 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] text-navy-700">حساب</span>}
                  </td>
                  <td className="p-2" dir="ltr"><a href={`tel:${r.reporterPhone}`} className="text-accent hover:underline">{r.reporterPhone || '—'}</a></td>
                  <td className="p-2" dir="ltr">{fmt(r.fbDate)}</td>
                  <td className="p-2">{r.city?.name ?? '—'}</td>
                  <td className="p-2">{r.originalOwner ?? '—'}</td>
                  <td className="p-2">{r.blockNo ?? '—'}</td>
                  <td className="p-2">{r.plotNo ?? '—'}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      {(photosBy.get(r.id) ?? []).map((p, i) => (
                        <a key={i} href={p} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p} alt="" className="h-10 w-10 rounded object-cover ring-1 ring-graphite/20" />
                        </a>
                      ))}
                      {!(photosBy.get(r.id)?.length) && <span className="opacity-40">—</span>}
                    </div>
                  </td>
                  <td className="p-2"><ReportRowActions id={r.id} status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
