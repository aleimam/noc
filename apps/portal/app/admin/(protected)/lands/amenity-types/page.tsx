import { requirePermission } from '@noc/auth';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { AmenityTypesManager } from './AmenityTypesManager';

export const dynamic = 'force-dynamic';

export default async function AmenityTypesPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const types = await prisma.amenityType.findMany({ orderBy: [{ order: 'asc' }], include: { _count: { select: { amenities: true } } } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('amenityTypes')}</h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <p className="text-sm opacity-70">{t('amenityTypesHint')}</p>
      <AmenityTypesManager
        types={types.map((x) => ({ id: x.id, titleAr: x.titleAr, titleEn: x.titleEn, order: x.order, isActive: x.isActive, count: x._count.amenities }))}
        locale={locale}
      />
    </div>
  );
}
