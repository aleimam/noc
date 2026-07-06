import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { PhotoGallery, ListingCard } from '@noc/ui';
import { localizeUnit, currency, type Locale } from '@noc/i18n';
import { BUILDING_TYPES, MAIN_ROADS } from '@noc/config';
import { FollowArea } from '../FollowArea';
import { LoginToView } from '../../_components/LoginToView';
import { areaListings } from '../../../lib/areaListings';
import { getSecurityGates } from '../../../lib/security';
import { amenitiesForNeighborhood } from '../../../lib/amenities';
import { SiteShell } from '../../_components/SiteShell';
import { pageMeta, breadcrumbLd, ldJson } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const n = await prisma.neighborhood.findUnique({ where: { id }, select: { nameAr: true, nameEn: true, isActive: true, district: { select: { nameAr: true, nameEn: true } } } });
  if (!n || !n.isActive) return { title: locale === 'en' ? 'Explore — New Obour' : 'استكشف — العبور الجديد' };
  const name = locale === 'ar' ? n.nameAr : n.nameEn;
  const dist = locale === 'ar' ? n.district.nameAr : n.district.nameEn;
  return pageMeta({
    title: `${name} — ${dist} — ${locale === 'en' ? 'New Obour' : 'العبور الجديد'}`,
    description: locale === 'en'
      ? `${name} neighborhood in ${dist}, New Obour City: plot areas, building types, roads, public realm and lands for sale.`
      : `مجاورة ${name} في ${dist} بمدينة العبور الجديدة: مساحات القطع وأنواع البناء والطرق والمرافق والأراضي المعروضة.`,
    path: `/explore/${id}`,
    locale,
  });
}

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

  const [advantages, areaMaps, updates, amenityRows] = await Promise.all([
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    prisma.areaMap.findMany({ where: { level: 'neighborhood', areaId: id } }),
    // neighborhood updates + inherited district updates, newest first
    prisma.geoUpdate.findMany({
      where: { OR: [{ neighborhoodId: id }, { districtId: n.districtId }] },
      orderBy: { happenedAt: 'desc' },
      take: 50,
    }),
    // attached amenities: this neighborhood's own + inherited from its district
    amenitiesForNeighborhood(id, n.districtId),
  ]);
  const listingCards = await areaListings({ neighborhoodId: id });
  const pickMap = (kind: string) => {
    const r = areaMaps.find((x) => x.kind === kind);
    return r ? r.newobourPath || r.cleanPath : null;
  };
  const locationMap = pickMap('location');
  const masterplanMap = pickMap('masterplan');

  // Maps stay open at LIGHT/MEDIUM; only the HIGH break-glass posture requires login.
  const [gates, session] = await Promise.all([getSecurityGates(), auth()]);
  const showMaps = !gates.loginWall || !!session?.user;

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

  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: t('exploreTitle'), path: '/explore' },
    { name: L(n.district.nameAr, n.district.nameEn), path: `/explore/district/${n.districtId}` },
    { name: L(n.nameAr, n.nameEn), path: `/explore/${n.id}` },
  ]);

  return (
    <SiteShell active="explore">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbsLd) }} />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/explore" className="text-sm text-accent">← {t('exploreTitle')}</a>
      <div>
        <a href={`/explore/district/${n.districtId}`} className="inline-block rounded bg-graphite/10 px-2 py-0.5 text-xs text-accent hover:underline">{L(n.district.nameAr, n.district.nameEn)}</a>
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

      {amenityRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('publicRealm')}</h2>
          <ul className="space-y-2">
            {amenityRows.map((a) => (
              <li key={a.id} className="rounded-lg border border-graphite/15 p-3">
                {a.category && <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{L(a.category.ar, a.category.en)}</span>}
                <span className="ms-2 font-semibold">{L(a.titleAr, a.titleEn || a.titleAr)}</span>
                {(a.detailsAr || a.detailsEn) && <p className="mt-1 whitespace-pre-line text-sm opacity-80">{locale === 'ar' ? a.detailsAr : a.detailsEn || a.detailsAr}</p>}
                {a.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={a.photos} /></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {locationMap && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')}</h2>
          {showMaps ? (
            <PhotoGallery photos={[locationMap]} />
          ) : (
            <LoginToView
              next={`/explore/${n.id}`}
              title={L('الخرائط تتطلب تسجيل الدخول', 'Sign in to view maps')}
              note={L('سجّل الدخول برقم هاتفك لعرض الخرائط.', 'Sign in with your phone number to view the maps.')}
              cta={L('تسجيل الدخول', 'Sign in')}
            />
          )}
        </section>
      )}
      {masterplanMap && showMaps && (
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
      </div>
    </SiteShell>
  );
}
