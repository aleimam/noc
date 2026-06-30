import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AdvantagesEditor, AreaMapEditor, AdjacencyEditor, UpdatesEditor } from '../../GeoContentEditors';
import { loadUpdates, loadAreaMaps, followerCount, loadAdjacency } from '../../geo';

export const dynamic = 'force-dynamic';

export default async function DistrictDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const district = await prisma.district.findUnique({ where: { id } });
  if (!district) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, updates, maps, followers, adjacency, others] = await Promise.all([
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    loadUpdates({ districtId: id }),
    loadAreaMaps('district', id),
    followerCount('district', id),
    loadAdjacency('district', id),
    prisma.district.findMany({ where: { id: { not: id } }, orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  const candidates = others.map((d) => ({ id: d.id, name: L(d.nameAr, d.nameEn) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L(district.nameAr, district.nameEn)}</h1>
        <a href="/admin/lands/districts" className="text-sm text-accent">← {t('districts')}</a>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="district" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          <AreaMapEditor level="district" targetId={id} kind="location" map={maps.location} />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
          <AreaMapEditor level="district" targetId={id} kind="masterplan" map={maps.masterplan} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('adjacency')}</h2>
        <AdjacencyEditor level="district" targetId={id} candidates={candidates} selected={adjacency} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        <UpdatesEditor level="district" targetId={id} updates={updates} followerCount={followers} locale={locale} />
      </section>
    </div>
  );
}
