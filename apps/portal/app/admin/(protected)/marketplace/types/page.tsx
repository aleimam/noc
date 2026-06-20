import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../CatalogTable';
import { upsertPropertyType, deletePropertyType } from '../actions';

export default async function TypesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const rows = await prisma.propertyType.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { attributes: true, listings: true } } },
  });
  const data = rows.map((x) => ({
    id: x.id,
    key: x.key,
    nameAr: x.nameAr,
    nameEn: x.nameEn,
    order: x.order,
    isActive: x.isActive,
    meta: `${x._count.attributes} ${t('attributeCount')}`,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('propertyTypes')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <CatalogTable initial={data} upsert={upsertPropertyType} remove={deletePropertyType} />
    </div>
  );
}
