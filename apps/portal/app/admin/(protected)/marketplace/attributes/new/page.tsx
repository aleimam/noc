import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AttributeForm, type AttrData } from '../AttributeForm';
import { upsertAttribute } from '../../actions';

export default async function NewAttribute() {
  await requirePermission('catalog', 'CREATE');
  const [sections, classifiers, lists] = await Promise.all([
    prisma.attributeSection.findMany({ orderBy: { order: 'asc' } }),
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } } },
    }),
    prisma.optionList.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const t = await getTranslations('mp');

  const initial: AttrData = {
    key: '',
    sectionId: sections[0]?.id ?? '',
    labelAr: '',
    labelEn: '',
    type: 'TEXT',
    unit: '',
    helpAr: '',
    helpEn: '',
    config: {},
    filterable: false,
    required: false,
    order: 0,
    isActive: true,
    options: [],
    optionListId: '',
    optionIds: [],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('attributes')}: {t('new')}</h1>
        <a href="/admin/marketplace/attributes" className="text-sm text-accent">← {t('attributes')}</a>
      </div>
      <AttributeForm
        initial={initial}
        sections={sections.map((s) => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn }))}
        classifiers={classifiers.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, options: c.options }))}
        lists={lists}
        action={upsertAttribute}
      />
    </div>
  );
}
