import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, ListingCard } from '@noc/ui';
import { localizeUnit, currency, type Locale } from '@noc/i18n';
import { areaListings } from '../../../../lib/areaListings';

export const dynamic = 'force-dynamic';

export default async function DistrictPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.district.findUnique({
    where: { id },
    include: { neighborhoods: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  if (!d || !d.isActive) notFound();

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);

  const [advantages, areaMaps, updates] = await Promise.all([
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    prisma.areaMap.findMany({ where: { level: 'district', areaId: id } }),
    prisma.geoUpdate.findMany({ where: { districtId: id, neighborhoodId: null }, orderBy: { happenedAt: 'desc' }, take: 50 }),
  ]);
  const listingCards = await areaListings({ neighborhood: { districtId: id } });

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
  const fmt = (dt: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  const pickMap = (kind: string) => {
    const r = areaMaps.find((x) => x.kind === kind);
    return r ? r.newobourPath || r.cleanPath : null;
  };
  const locationMap = pickMap('location');
  const masterplanMap = pickMap('masterplan');

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/explore" className="text-sm text-accent">← {t('exploreTitle')}</a>
      <h1 className="text-2xl font-bold text-primary">{L(d.nameAr, d.nameEn)}</h1>

      {d.neighborhoods.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('neighborhoods')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.neighborhoods.map((n) => {
              const areas = (n.areas as number[] | null) ?? [];
              return (
                <a key={n.id} href={`/explore/${n.id}`} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                  <div className="font-semibold">{L(n.nameAr, n.nameEn)}</div>
                  <div className="mt-1 text-xs opacity-70">{n.assortedAreas ? t('assorted') : areas.length ? `${areas.join('، ')} ${m2}` : '—'}</div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {advantages.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('advantages')}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {advantages.map((a) => <li key={a.id}>{locale === 'ar' ? a.textAr : a.textEn || a.textAr}</li>)}
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

      {listingCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-primary">{t('listingsHere')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listingCards.map((c) => (
              <ListingCard key={c.id} href={`/market/${c.id}`} cover={c.cover} title={c.title} subtitle={L(c.typeAr, c.typeEn)} price={c.price} currency={currency(locale)} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
