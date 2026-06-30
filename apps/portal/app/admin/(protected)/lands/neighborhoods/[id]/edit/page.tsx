import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { BlocksManager } from '../../../BlocksManager';
import { AdvantagesEditor, AreaMapEditor, AdjacencyEditor, AmenitiesEditor, UpdatesEditor, InheritedUpdates } from '../../../GeoContentEditors';
import { loadUpdates, loadAreaMaps, followerCount, loadAdjacency, loadAmenities } from '../../../geo';
import { EditSaveBar } from '@/app/_components/EditSaveBar';

export const dynamic = 'force-dynamic';

export default async function NeighborhoodEdit({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const n = await prisma.neighborhood.findUnique({ where: { id }, include: { district: true, blocks: { orderBy: { order: 'asc' } } } });
  if (!n) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [advantages, updates, maps, followers, adjacency, others, inherited, amenityTypes, amenities] = await Promise.all([
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    loadUpdates({ neighborhoodId: id }),
    loadAreaMaps('neighborhood', id),
    followerCount('neighborhood', id),
    loadAdjacency('neighborhood', id),
    prisma.neighborhood.findMany({ where: { id: { not: id } }, orderBy: [{ order: 'asc' }], include: { district: true } }),
    loadUpdates({ districtId: n.districtId }),
    prisma.amenityType.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }] }),
    loadAmenities(id),
  ]);
  const candidates = others.map((o) => ({ id: o.id, name: `${L(o.district.nameAr, o.district.nameEn)} · ${L(o.nameAr, o.nameEn)}` }));
  const types = amenityTypes.map((x) => ({ id: x.id, name: L(x.titleAr, x.titleEn) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {L(n.district.nameAr, n.district.nameEn)} · {L(n.nameAr, n.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href={`/admin/lands/neighborhoods/${id}`} className="text-sm text-accent">← {t('details')}</a>
          <EditSaveBar hint />
        </div>
      </div>

      {n.hasBlocks && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('blocks')}</h2>
          <BlocksManager neighborhoodId={n.id} blocks={n.blocks.map((b) => ({ id: b.id, name: b.name, order: b.order }))} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('advantages')}</h2>
        <AdvantagesEditor level="neighborhood" targetId={id} advantages={advantages.map((a) => ({ id: a.id, textAr: a.textAr, textEn: a.textEn, order: a.order }))} locale={locale} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('publicRealm')}</h2>
        <AmenitiesEditor neighborhoodId={id} types={types.map((x) => ({ id: x.id, title: x.name }))} amenities={amenities} locale={locale} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          <AreaMapEditor level="neighborhood" targetId={id} kind="location" map={maps.location} />
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
          <AreaMapEditor level="neighborhood" targetId={id} kind="masterplan" map={maps.masterplan} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('adjacency')}</h2>
        <AdjacencyEditor level="neighborhood" targetId={id} candidates={candidates} selected={adjacency} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        <UpdatesEditor level="neighborhood" targetId={id} updates={updates} followerCount={followers} locale={locale} />
        {inherited.length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-semibold opacity-70">{L(n.district.nameAr, n.district.nameEn)}</h3>
            <InheritedUpdates updates={inherited} locale={locale} sourceLabel={L(n.district.nameAr, n.district.nameEn)} />
          </>
        )}
      </section>

      <div className="flex justify-end border-t border-graphite/15 pt-4"><EditSaveBar /></div>
    </div>
  );
}
