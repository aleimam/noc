import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DeleteConditionButton } from './DeleteConditionButton';

export const dynamic = 'force-dynamic';

export default async function BuildingConditionsAdmin() {
  await requirePermission('guide', 'VIEW');
  const rows = await prisma.buildingCondition.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">اشتراطات البناء</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/guide/conditions/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ صفحة جديدة</a>
          <a href="/admin/guide" className="text-sm text-accent">← الدليل</a>
        </div>
      </div>
      <p className="text-sm opacity-70">اشتراطات ومسطحات البناء لكل وحدة (مساحة أرض أو نوع). يمكن ربطها بأي عرض.</p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-8 text-center text-sm opacity-60">لا توجد صفحات بعد.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-graphite/5">
              <tr>
                <th className="p-2 text-start">الوحدة</th>
                <th className="p-2 text-start">العنوان</th>
                <th className="p-2 text-start">الرابط</th>
                <th className="p-2 text-start">الترتيب</th>
                <th className="p-2 text-start">منشور</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">{r.unitLabelAr}</td>
                  <td className="p-2">{r.titleAr}</td>
                  <td className="p-2 font-mono text-xs opacity-60" dir="ltr">{r.slug}</td>
                  <td className="p-2">{r.order}</td>
                  <td className="p-2">{r.published ? '✔' : '—'}</td>
                  <td className="whitespace-nowrap p-2 text-end">
                    <a href={`/admin/guide/conditions/${r.id}`} className="text-accent">تعديل</a>
                    <span className="mx-2 opacity-30">|</span>
                    <DeleteConditionButton id={r.id} />
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
