import { notFound } from 'next/navigation';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ConditionEditor } from '../ConditionEditor';

export const dynamic = 'force-dynamic';

export default async function EditBuildingCondition({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('guide', 'VIEW');
  const { id } = await params;
  const c = await prisma.buildingCondition.findUnique({ where: { id } });
  if (!c) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">تعديل: {c.unitLabelAr}</h1>
        <a href="/admin/guide/conditions" className="text-sm text-accent">← رجوع</a>
      </div>
      <ConditionEditor
        initial={{ id: c.id, slug: c.slug, unitLabelAr: c.unitLabelAr, unitLabelEn: c.unitLabelEn, titleAr: c.titleAr, titleEn: c.titleEn, bodyAr: c.bodyAr, bodyEn: c.bodyEn, order: c.order, published: c.published }}
      />
    </div>
  );
}
