import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { localizeUnit, type Locale } from '@noc/i18n';
import { BUILDING_TYPES, MAIN_ROADS } from '@noc/config';
import { FollowArea } from '../FollowArea';

export const dynamic = 'force-dynamic';

function labels(keys: string[], dict: readonly { key: string; ar: string; en: string }[], locale: Locale) {
  return keys.map((k) => {
    const d = dict.find((x) => x.key === k);
    return d ? (locale === 'ar' ? d.ar : d.en) : k;
  });
}

export default async function NeighborhoodPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = await prisma.neighborhood.findUnique({ where: { id }, include: { district: true } });
  if (!n || !n.isActive) notFound();

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);

  const [advantages, areaMaps, updates] = await Promise.all([
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    prisma.areaMap.findMany({ where: { level: 'neighborhood', areaId: id } }),
    // neighborhood updates + inherited district updates, newest first
    prisma.geoUpdate.findMany({
      where: { OR: [{ neighborhoodId: id }, { districtId: n.districtId }] },
      orderBy: { happenedAt: 'desc' },
      take: 50,
    }),
  ]);
  const pickMap = (kind: string) => {
    const r = areaMaps.find((x) => x.kind === kind);
    return r ? r.newobourPath || r.cleanPath : null;
  };
  const locationMap = pickMap('location');
  const masterplanMap = pickMap('masterplan');
  const updIds = updates.map((u) => u.id);
  const photos = updIds.length
    ? await prisma.attachment.findMany({ where: { ownerType: 'GeoUpdate', ownerId: { in: updIds } }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } })
    : [];
  const photosByUpdate = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.ownerId) continue;
    const arr = photosByUpdate.get(p.ownerId) ?? [];
    arr.push(p.path);
    photosByUpdate.set(p.ownerId, arr);
  }
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  const areas = (n.areas as number[] | null) ?? [];
  const buildingTypes = labels((n.buildingTypes as string[] | null) ?? [], BUILDING_TYPES, locale);
  const mainRoads = labels((n.mainRoads as string[] | null) ?? [], MAIN_ROADS, locale);

  const chips = (items: string[]) => (
    <div className="flex flex-wrap gap-2">
      {items.map((x, i) => (
        <span key={i} className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{x}</span>
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/explore" className="text-sm text-accent">← {t('exploreTitle')}</a>
      <div>
        <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{L(n.district.nameAr, n.district.nameEn)}</span>
        <h1 className="mt-2 text-2xl font-bold text-primary">{L(n.nameAr, n.nameEn)}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm font-semibold opacity-70">{t('areas')}</div>
          <div className="text-sm">{n.assortedAreas ? t('assorted') : areas.length ? `${areas.join('، ')} ${m2}` : '—'}</div>
        </div>
        {buildingTypes.length > 0 && (
          <div className="space-y-1">
            <div className="text-sm font-semibold opacity-70">{t('buildingTypes')}</div>
            {chips(buildingTypes)}
          </div>
        )}
        {mainRoads.length > 0 && (
          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-semibold opacity-70">{t('mainRoads')}</div>
            {chips(mainRoads)}
          </div>
        )}
      </div>

      <FollowArea neighborhoodId={id} />

      {advantages.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('advantages')}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {advantages.map((a) => (
              <li key={a.id}>{locale === 'ar' ? a.textAr : a.textEn || a.textAr}</li>
            ))}
          </ul>
        </section>
      )}

      {locationMap && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          <PhotoGallery photos={[locationMap]} />
        </section>
      )}
      {masterplanMap && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('masterplan')}</h2>
          <PhotoGallery photos={[masterplanMap]} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        {updates.length === 0 && <p className="text-sm opacity-60">{t('noUpdates')}</p>}
        <ul className="space-y-2">
          {updates.map((u) => {
            const pics = photosByUpdate.get(u.id) ?? [];
            return (
              <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
                <div className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)}</div>
                {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
                <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
                {pics.length > 0 && <div className="mt-2"><PhotoGallery photos={pics} /></div>}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
