import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../CatalogTable';
import { upsertPropertyCategory, deletePropertyCategory } from '../actions';

export default async function CategoriesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const rows = await prisma.propertyCategory.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { groups: true } } },
  });
  const data = rows.map((x) => ({
    id: x.id,
    key: x.key,
    nameAr: x.nameAr,
    nameEn: x.nameEn,
    order: x.order,
    isActive: x.isActive,
    meta: `${x._count.groups} ${t('groupCount')}`,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('categories')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <p className="text-sm opacity-70">{t('categoriesHint')}</p>
      <CatalogTable
        initial={data}
        upsert={upsertPropertyCategory}
        remove={deletePropertyCategory}
        detailBase="/admin/marketplace/categories"
      />
    </div>
  );
}
