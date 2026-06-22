import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AttributeForm, type AttrData } from '../AttributeForm';
import { upsertAttribute } from '../../actions';

export default async function EditAttribute({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const [attr, sections, classifiers] = await Promise.all([
    prisma.attribute.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } }, classifierLinks: true },
    }),
    prisma.attributeSection.findMany({ orderBy: { order: 'asc' } }),
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } } },
    }),
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
    optionIds: attr.classifierLinks.map((l) => l.optionId),
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
        classifiers={classifiers.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, options: c.options }))}
        action={upsertAttribute}
      />
    </div>
  );
}
