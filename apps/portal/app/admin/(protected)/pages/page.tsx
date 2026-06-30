import Link from 'next/link';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DeletePageButton } from './DeletePageButton';

export const dynamic = 'force-dynamic';
const BRAND = { newobour: 'العبور الجديد', alsawarey: 'الصواري' } as Record<string, string>;

export default async function PagesAdmin() {
  await requirePermission('pages', 'VIEW');
  const pages = await prisma.page.findMany({ orderBy: [{ brand: 'asc' }, { footerOrder: 'asc' }] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">الصفحات الثابتة</h1>
        <Link href="/admin/pages/new" className="rounded-md bg-primary px-4 py-2 text-sm text-soft">+ صفحة جديدة</Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="opacity-60">
            <tr>
              <th className="p-2 text-start">الموقع</th>
              <th className="p-2 text-start">العنوان</th>
              <th className="p-2 text-start">الرابط</th>
              <th className="p-2 text-start">منشور</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && <tr><td colSpan={5} className="p-4 text-center opacity-60">لا توجد صفحات</td></tr>}
            {pages.map((p) => (
              <tr key={p.id} className="border-t border-graphite/10">
                <td className="p-2">{BRAND[p.brand] ?? p.brand}</td>
                <td className="p-2 font-medium">{p.titleAr}</td>
                <td className="p-2 font-mono text-xs" dir="ltr">/p/{p.slug}</td>
                <td className="p-2">{p.published ? '✔' : '—'}</td>
                <td className="whitespace-nowrap p-2 text-end">
                  <Link href={`/admin/pages/${p.id}`} className="px-2 py-1 text-accent">تعديل</Link>
                  <DeletePageButton id={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
