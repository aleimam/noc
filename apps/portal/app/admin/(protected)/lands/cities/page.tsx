import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../../marketplace/CatalogTable';
import { upsertCity, deleteCity } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const cities = await prisma.city.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { districts: true } } },
  });
  const rows = cities.map((c) => ({
    id: c.id,
    key: c.key,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    order: c.order,
    isActive: c.isActive,
    meta: `${c._count.districts} ${t('districts')}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('cities')}</h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <CatalogTable initial={rows} upsert={upsertCity} remove={deleteCity} detailBase="/admin/lands/cities" newHref="/admin/lands/cities/new" editBase="/admin/lands/cities" editSuffix="/edit" />
    </div>
  );
}
