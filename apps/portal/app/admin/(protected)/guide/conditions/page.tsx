import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DeleteConditionButton } from './DeleteConditionButton';

export const dynamic = 'force-dynamic';

export default async function BuildingConditionsAdmin() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('content', 'VIEW');
  const rows = await prisma.buildingCondition.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('اشتراطات البناء', 'Building requirements')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/guide/conditions/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">{L('+ صفحة جديدة', '+ New page')}</a>
          <a href="/admin/guide" className="text-sm text-accent">{L('← الدليل', '← Guide')}</a>
        </div>
      </div>
      <p className="text-sm opacity-70">{L('اشتراطات ومسطحات البناء لكل وحدة (مساحة أرض أو نوع). يمكن ربطها بأي عرض.', 'Building requirements and floor areas per unit (land area or type). Each can be linked to any listing.')}</p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-8 text-center text-sm opacity-60">{L('لا توجد صفحات بعد.', 'No pages yet.')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="bg-graphite/5">
              <tr>
                <th className="p-2 text-start">{L('الوحدة', 'Unit')}</th>
                <th className="p-2 text-start">{L('العنوان', 'Title')}</th>
                <th className="p-2 text-start">{L('الرابط', 'Link')}</th>
                <th className="p-2 text-start">{L('الترتيب', 'Order')}</th>
                <th className="p-2 text-start">{L('منشور', 'Published')}</th>
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
                    <a href={`/admin/guide/conditions/${r.id}`} className="text-accent">{L('تعديل', 'Edit')}</a>
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
