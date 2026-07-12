import { notFound } from 'next/navigation';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { PageEditor } from '../PageEditor';

export const dynamic = 'force-dynamic';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('content', 'UPDATE');
  const { id } = await params;
  const p = await prisma.page.findUnique({ where: { id } });
  if (!p) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">تعديل: {p.titleAr}</h1>
        <a href="/admin/pages" className="text-sm text-accent">← الصفحات</a>
      </div>
      <PageEditor
        initial={{
          id: p.id,
          brand: p.brand,
          slug: p.slug,
          titleAr: p.titleAr,
          titleEn: p.titleEn ?? '',
          bodyAr: p.bodyAr,
          bodyEn: p.bodyEn ?? '',
          published: p.published,
          footerOrder: p.footerOrder,
        }}
      />
    </div>
  );
}
