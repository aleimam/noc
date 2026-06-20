import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AttributeForm, type AttrData } from '../AttributeForm';
import { upsertAttribute } from '../../actions';

export default async function EditAttribute({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const [attr, sections, types] = await Promise.all([
    prisma.attribute.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } }, typeLinks: true },
    }),
    prisma.attributeSection.findMany({ orderBy: { order: 'asc' } }),
    prisma.propertyType.findMany({ orderBy: { order: 'asc' } }),
  ]);
  if (!attr) notFound();
  const t = await getTranslations('mp');

  const initial: AttrData = {
    id: attr.id,
    key: attr.key,
    sectionId: attr.sectionId,
    labelAr: attr.labelAr,
    labelEn: attr.labelEn,
    type: attr.type as AttrData['type'],
    unit: attr.unit ?? '',
    filterable: attr.filterable,
    order: attr.order,
    isActive: attr.isActive,
    options: attr.options.map((o) => ({ id: o.id, key: o.key, labelAr: o.labelAr, labelEn: o.labelEn })),
    typeIds: attr.typeLinks.map((l) => l.propertyTypeId),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {attr.labelAr}</h1>
        <a href="/admin/marketplace/attributes" className="text-sm text-accent">← {t('attributes')}</a>
      </div>
      <AttributeForm
        initial={initial}
        sections={sections.map((s) => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn }))}
        types={types.map((x) => ({ id: x.id, nameAr: x.nameAr, nameEn: x.nameEn }))}
        action={upsertAttribute}
      />
    </div>
  );
}
