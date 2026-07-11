import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { AdvantagesEditor, AreaMapEditor, AdjacencyEditor, UpdatesEditor } from '../../../GeoContentEditors';
import { loadUpdates, loadAreaMaps, followerCount, loadAdjacency, masterplanClean } from '../../../geo';
import { AmenityAttachPicker } from '../../../AmenityAttachPicker';
import { amenityPickOptions, placedAmenityIds } from '@/lib/amenities';
import { EditSaveBar } from '@/app/_components/EditSaveBar';

export const dynamic = 'force-dynamic';

export default async function DistrictEdit({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'UPDATE');
  const { id } = await params;
  const district = await prisma.district.findUnique({ where: { id } });
  if (!district) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, updates, maps, followers, adjacency, others, amenityOptions, attachedAmenities] = await Promise.all([
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    loadUpdates({ districtId: id }),
    loadAreaMaps('district', id),
    followerCount('district', id),
    loadAdjacency('district', id),
    prisma.district.findMany({ where: { id: { not: id } }, orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    amenityPickOptions(locale),
    placedAmenityIds('district', id),
  ]);
  const candidates = others.map((d) => ({ id: d.id, name: L(d.nameAr, d.nameEn) }));
  // The district's location map is drawn on its city's masterplan.
  const cityMasterplan = await masterplanClean('city', district.cityId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {L(district.nameAr, district.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href={`/admin/lands/districts/${id}`} className="text-sm text-accent">← {t('details')}</a>
          <EditSaveBar hint />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="district" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('publicRealm')}</h2>
        <AmenityAttachPicker scope="district" scopeId={id} options={amenityOptions} initial={attachedAmenities} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          <AreaMapEditor level="district" targetId={id} kind="location" map={maps.location} parentMasterplan={cityMasterplan} annotation={maps.locationAnnotation} />
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

      <div className="flex justify-end border-t border-graphite/15 pt-4"><EditSaveBar /></div>
    </div>
  );
}
