import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../../marketplace/CatalogTable';
import { upsertDistrict, deleteDistrict } from '../actions';

export const dynamic = 'force-dynamic';

export default async function DistrictsPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const districts = await prisma.district.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { neighborhoods: true } } },
  });
  const rows = districts.map((d) => ({
    id: d.id,
    key: d.key,
    nameAr: d.nameAr,
    nameEn: d.nameEn,
    order: d.order,
    isActive: d.isActive,
    meta: `${d._count.neighborhoods} ${t('neighborhoods')}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('districts')}</h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <CatalogTable
        initial={rows}
        upsert={upsertDistrict}
        remove={deleteDistrict}
        detailBase="/admin/lands/districts"
        childAdd={{ hrefBase: '/admin/lands/neighborhoods/new', label: `+ ${t('addNeighborhood')}` }}
      />
    </div>
  );
}
