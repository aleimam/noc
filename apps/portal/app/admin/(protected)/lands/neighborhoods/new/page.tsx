import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { NewNeighborhoodForm } from './NewNeighborhoodForm';

export const dynamic = 'force-dynamic';

export default async function NewNeighborhood({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('lands', 'CREATE');
  const sp = await searchParams;
  const districtId = typeof sp.district === 'string' ? sp.district : '';
  const district = districtId ? await prisma.district.findUnique({ where: { id: districtId } }) : null;
  if (!district) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('addNeighborhood')} — {L(district.nameAr, district.nameEn)}</h1>
        <a href={`/admin/lands/districts/${districtId}`} className="text-sm text-accent">← {t('details')}</a>
      </div>
      <NewNeighborhoodForm districtId={districtId} />
    </div>
  );
}
