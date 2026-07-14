import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { NewDistrictForm } from './NewDistrictForm';

export const dynamic = 'force-dynamic';

export default async function NewDistrict() {
  await requirePermission('lands', 'CREATE');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const cities = await prisma.city.findMany({ orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('addDistrict')}</h1>
        <a href="/admin/lands/districts" className="text-sm text-accent">← {t('districts')}</a>
      </div>
      <NewDistrictForm cities={cities.map((c) => ({ id: c.id, name: L(c.nameAr, c.nameEn) }))} />
    </div>
  );
}
