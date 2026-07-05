import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { listLibraryAmenities } from '../../../../../lib/amenities';
import { getAmenityCategoryListId } from '../actions';
import { AmenitiesLibraryManager } from './AmenitiesLibraryManager';

export const dynamic = 'force-dynamic';

export default async function AmenityLibraryPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const listId = await getAmenityCategoryListId();
  const [rows, cats] = await Promise.all([
    listLibraryAmenities(),
    prisma.optionListItem.findMany({ where: { listId, isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } }),
  ]);
  const categories = cats.map((c) => ({ id: c.id, label: locale === 'en' ? c.labelEn || c.labelAr : c.labelAr }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('amenityLibrary')}</h1>
        <a href="/admin/marketplace/option-lists" className="text-sm text-accent">{t('amenityCategories')} ↗</a>
      </div>
      <p className="text-sm opacity-60">{t('amenityLibraryHint')} — {t('amenityCategoriesHint')}</p>
      <AmenitiesLibraryManager initial={rows} categories={categories} locale={locale} />
    </div>
  );
}
