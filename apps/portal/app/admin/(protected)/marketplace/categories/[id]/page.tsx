import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CatalogTable } from '../../CatalogTable';
import { upsertPropertyGroup, deletePropertyGroup } from '../../actions';

export default async function CategoryGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const t = await getTranslations('mp');
  const category = await prisma.propertyCategory.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { order: 'asc' }, include: { _count: { select: { types: true } } } },
    },
  });
  if (!category) notFound();
  const data = category.groups.map((g) => ({
    id: g.id,
    key: g.key,
    nameAr: g.nameAr,
    nameEn: g.nameEn,
    order: g.order,
    isActive: g.isActive,
    meta: `${g._count.types} ${t('typeCount')}`,
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {category.nameAr} · {t('groups')}
        </h1>
        <a href="/admin/marketplace/categories" className="text-sm text-accent">← {t('categories')}</a>
      </div>
      <p className="text-sm opacity-70">{t('groupsHint')}</p>
      <CatalogTable
        initial={data}
        upsert={upsertPropertyGroup.bind(null, category.id)}
        remove={deletePropertyGroup}
      />
    </div>
  );
}
