import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AttributeForm, type AttrData } from '../AttributeForm';
import { upsertAttribute } from '../../actions';

export default async function NewAttribute() {
  await requirePermission('marketplace', 'CREATE');
  const [sections, types] = await Promise.all([
    prisma.attributeSection.findMany({ orderBy: { order: 'asc' } }),
    prisma.propertyType.findMany({ orderBy: { order: 'asc' } }),
  ]);
  const t = await getTranslations('mp');

  const initial: AttrData = {
    key: '',
    sectionId: sections[0]?.id ?? '',
    labelAr: '',
    labelEn: '',
    type: 'TEXT',
    unit: '',
    filterable: false,
    order: 0,
    isActive: true,
    options: [],
    typeIds: [],
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
        types={types.map((x) => ({ id: x.id, nameAr: x.nameAr, nameEn: x.nameEn }))}
        action={upsertAttribute}
      />
    </div>
  );
}
