import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AttributeForm, type AttrData } from '../AttributeForm';
import { upsertAttribute, deleteAttribute } from '../../actions';

export default async function EditAttribute({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'UPDATE');
  const { id } = await params;
  const [attr, sections, classifiers, lists] = await Promise.all([
    prisma.attribute.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } }, classifierLinks: true },
    }),
    prisma.attributeSection.findMany({ orderBy: { order: 'asc' } }),
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } } },
    }),
    prisma.optionList.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
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
    helpAr: attr.helpAr ?? '',
    helpEn: attr.helpEn ?? '',
    config: (attr.config as AttrData['config']) ?? {},
    filterable: attr.filterable,
    order: attr.order,
    isActive: attr.isActive,
    options: attr.options.map((o) => ({ id: o.id, key: o.key, labelAr: o.labelAr, labelEn: o.labelEn })),
    optionListId: attr.optionListId ?? '',
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
        lists={lists}
        action={upsertAttribute}
        remove={deleteAttribute}
      />
    </div>
  );
}
