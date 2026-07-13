import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { NeighborhoodsManager } from '../NeighborhoodsManager';

export const dynamic = 'force-dynamic';

export default async function NeighborhoodsPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';

  const [neighborhoods, districts, maps] = await Promise.all([
    prisma.neighborhood.findMany({
      orderBy: [{ district: { order: 'asc' } }, { order: 'asc' }, { nameAr: 'asc' }],
    }),
    prisma.district.findMany({ orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    // Map coverage per neighborhood: does it have a masterplan / location map yet?
    prisma.areaMap.findMany({ where: { level: 'neighborhood', kind: { in: ['masterplan', 'location'] } }, select: { areaId: true, kind: true } }),
  ]);
  const hasMap = (id: string, kind: string) => maps.some((m) => m.areaId === id && m.kind === kind);

  const rows = neighborhoods.map((n) => ({
    id: n.id,
    districtId: n.districtId,
    nameAr: n.nameAr,
    nameEn: n.nameEn,
    hasBlocks: n.hasBlocks,
    assortedAreas: n.assortedAreas,
    areas: (n.areas as number[] | null) ?? [],
    buildingTypes: (n.buildingTypes as string[] | null) ?? [],
    mainRoads: (n.mainRoads as string[] | null) ?? [],
    order: n.order,
    isActive: n.isActive,
    hasMasterplan: hasMap(n.id, 'masterplan'),
    hasLocationMap: hasMap(n.id, 'location'),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('neighborhoods')}</h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <NeighborhoodsManager neighborhoods={rows} districts={districts} locale={locale} />
    </div>
  );
}
