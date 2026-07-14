import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { NewNeighborhoodForm } from './NewNeighborhoodForm';

export const dynamic = 'force-dynamic';

export default async function NewNeighborhood({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission('lands', 'CREATE');
  const sp = await searchParams;
  const presetId = typeof sp.district === 'string' ? sp.district : '';

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const all = await prisma.district.findMany({ orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true } });
  if (all.length === 0) notFound();
  // Arriving from a district locks to it; otherwise the form shows a district picker.
  const preset = presetId ? all.find((d) => d.id === presetId) : null;
  if (presetId && !preset) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('addNeighborhood')}{preset ? ` — ${L(preset.nameAr, preset.nameEn)}` : ''}
        </h1>
        <a href={preset ? `/admin/lands/districts/${preset.id}` : '/admin/lands/neighborhoods'} className="text-sm text-accent">← {preset ? t('details') : t('neighborhoods')}</a>
      </div>
      <NewNeighborhoodForm districts={all.map((d) => ({ id: d.id, name: L(d.nameAr, d.nameEn) }))} presetDistrictId={preset?.id ?? ''} />
    </div>
  );
}
