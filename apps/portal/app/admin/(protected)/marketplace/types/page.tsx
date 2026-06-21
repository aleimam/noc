import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { TypesManager } from './TypesManager';

export default async function TypesPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const [types, categories] = await Promise.all([
    prisma.propertyType.findMany({
      orderBy: { order: 'asc' },
      include: { group: { include: { category: true } } },
    }),
    prisma.propertyCategory.findMany({
      orderBy: { order: 'asc' },
      include: { groups: { orderBy: { order: 'asc' } } },
    }),
  ]);
  const groups = categories.flatMap((c) =>
    c.groups.map((g) => ({ id: g.id, label: `${g.nameAr} / ${g.nameEn}`, category: `${c.nameAr} / ${c.nameEn}` })),
  );
  const rows = types.map((x) => ({
    id: x.id,
    key: x.key,
    nameAr: x.nameAr,
    nameEn: x.nameEn,
    order: x.order,
    isActive: x.isActive,
    groupId: x.groupId ?? null,
    groupLabel: x.group ? `${x.group.category.nameAr} › ${x.group.nameAr}` : '',
  }));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('propertyTypes')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <TypesManager initial={rows} groups={groups} />
    </div>
  );
}
