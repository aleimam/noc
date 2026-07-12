import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, ListingCard } from '@noc/ui';
import { localizeUnit, currency, type Locale } from '@noc/i18n';
import { BUILDING_TYPES, MAIN_ROADS } from '@noc/config';
import { FollowArea } from '../../FollowArea';
import { areaListings } from '../../../../lib/areaListings';
import { amenitiesForNeighborhood } from '../../../../lib/amenities';
import { getGeoInheritance, updatesForNeighborhood, customPhotosForNeighborhood } from '../../../../lib/geoInheritance';
import { SiteShell } from '../../../_components/SiteShell';
import { pageMeta, breadcrumbLd, ldJson } from '../../../../lib/seo';
import { geoPhotoAlt } from '../../../../lib/imageAlt';
import { neighborhoodSummary } from '../../../../lib/geoSummary';
import { GeoSummary } from '../../../_components/SeoText';
import { districtHref, neighborhoodHref, neighborhoodParam, resolveNeighborhoodId } from '../../../../lib/geoHref';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: param } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const resolved = await resolveNeighborhoodId(param);
  const n = resolved
    ? await prisma.neighborhood.findUnique({
        where: { id: resolved.id },
        select: { id: true, nameAr: true, nameEn: true, isActive: true, district: { select: { nameAr: true, nameEn: true } } },
      })
    : null;
  if (!n || !n.isActive) return { title: locale === 'en' ? 'Explore — New Obour' : 'استكشف — العبور الجديدة' };
  const name = locale === 'ar' ? n.nameAr : n.nameEn;
  const dist = locale === 'ar' ? n.district.nameAr : n.district.nameEn;
  return pageMeta({
    title: `${name} — ${dist} — ${locale === 'en' ? 'New Obour' : 'العبور الجديدة'}`,
    description: locale === 'en'
      ? `${name} neighborhood in ${dist}, New Obour City: plot areas, building types, roads, public realm and lands for sale.`
      : `مجاورة ${name} في ${dist} بمدينة العبور الجديدة: مساحات القطع وأنواع البناء والطرق والمرافق والأراضي المعروضة.`,
    path: neighborhoodHref(n),
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
  const { id: param } = await params;
  const resolved = await resolveNeighborhoodId(param);
  if (!resolved) notFound();
  const id = resolved.id;
  const n = await prisma.neighborhood.findUnique({ where: { id }, include: { district: true } });
  if (!n || !n.isActive) notFound();
  // Canonicalize: permanently redirect legacy cuids / mismatched slugs to the SEO URL (308).
  if (decodeURIComponent(param) !== neighborhoodParam(n)) permanentRedirect(neighborhoodHref(n));

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);
  const areaName = L(n.nameAr, n.nameEn); // for photo alt text (image SEO)

  const matrix = await getGeoInheritance();
  const [advantages, areaMaps, updates, amenityRows] = await Promise.all([
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    prisma.areaMap.findMany({ where: { level: 'neighborhood', areaId: id } }),
    // neighborhood updates + inherited district/city updates (per the matrix), source-tagged
    updatesForNeighborhood(id, n.districtId, n.district.cityId, matrix),
    // attached amenities: this neighborhood's own + inherited from its district (matrix-gated)
    amenitiesForNeighborhood(id, n.districtId, matrix),
  ]);
  const listingCards = await areaListings({ neighborhoodId: id });
  const pickRow = (kind: string) => areaMaps.find((x) => x.kind === kind) ?? null;
  const locationRow = pickRow('location');
  let locationMap = locationRow ? locationRow.newobourPath || locationRow.cleanPath : null;
  let locationTitle = locationRow?.title ?? null;
  // Inherit the district's location map when the neighborhood has none of its own (matrix-gated).
  // Display only — listings never embed this fallback; they use their own annotated map.
  if (!locationMap && n.districtId && matrix.maps.districtToNeighborhood) {
    const dm = await prisma.areaMap.findFirst({
      where: { level: 'district', areaId: n.districtId, kind: 'location' },
      select: { newobourPath: true, cleanPath: true, title: true },
    });
    locationMap = dm?.newobourPath || dm?.cleanPath || null;
    locationTitle = dm?.title ?? null;
  }
  const masterplanRow = pickRow('masterplan');
  const masterplanMap = masterplanRow ? masterplanRow.newobourPath || masterplanRow.cleanPath : null;
  // Own custom photos + inherited district & city photos (additive, matrix-gated); own first.
  const customPhotos = await customPhotosForNeighborhood(id, n.districtId, n.district.cityId, matrix);
  const photoChip = (s: 'city' | 'district' | 'neighborhood') =>
    s === 'city' ? L('من المدينة', 'From the city') : s === 'district' ? L('من الحي', 'From the district') : '';

  // Owner decision (2026-07-11): the geo explorer — details, maps, advantages — is fully public.
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const sourceChip = (s: 'city' | 'district' | 'neighborhood') =>
    s === 'city' ? L('المدينة', 'City') : s === 'district' ? L('الحي', 'District') : L('المجاورة', 'Neighborhood');

  const areas = (n.areas as number[] | null) ?? [];
  const buildingTypes = labels((n.buildingTypes as string[] | null) ?? [], BUILDING_TYPES, locale);
  const mainRoads = labels((n.mainRoads as string[] | null) ?? [], MAIN_ROADS, locale);
  const summary = neighborhoodSummary({
    name: L(n.nameAr, n.nameEn),
    district: L(n.district.nameAr, n.district.nameEn),
    areas,
    assorted: n.assortedAreas,
    buildingTypes,
    mainRoads,
    locale,
  });

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
    { name: L(n.district.nameAr, n.district.nameEn), path: districtHref(n.district) },
    { name: L(n.nameAr, n.nameEn), path: neighborhoodHref(n) },
  ]);

  return (
    <SiteShell active="explore">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbsLd) }} />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/explore" className="text-sm text-accent">‹ {t('exploreTitle')}</a>
      <div>
        <a href={districtHref(n.district)} className="inline-block rounded bg-graphite/10 px-2 py-0.5 text-xs text-accent hover:underline">{L(n.district.nameAr, n.district.nameEn)}</a>
        <h1 className="mt-2 text-2xl font-bold text-primary">{L(n.nameAr, n.nameEn)}</h1>
        <div className="mt-2"><GeoSummary text={summary} /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm font-semibold opacity-70">{t('areas')}</div>
          <div className="text-sm">{n.assortedAreas ? t('assorted') : areas.length ? `${areas.join(locale === 'ar' ? '، ' : ', ')} ${m2}` : '—'}</div>
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
                {a.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={a.photos} alt={geoPhotoAlt(areaName, L(a.titleAr, a.titleEn || a.titleAr), locale)} locale={locale} /></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {locationMap && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{locationTitle || t('locationMap')}</h2>
          <PhotoGallery photos={[locationMap]} alt={geoPhotoAlt(areaName, locationTitle || t('locationMap'), locale)} locale={locale} />
        </section>
      )}
      {masterplanMap && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{masterplanRow?.title || t('masterplan')}</h2>
          <PhotoGallery photos={[masterplanMap]} alt={geoPhotoAlt(areaName, masterplanRow?.title || t('masterplan'), locale)} locale={locale} />
        </section>
      )}

      {/* Extra branded photos: this neighborhood's own + inherited from district/city (additive). */}
      {customPhotos.map((c) => (
        <section key={c.kind} className="space-y-2">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold text-primary">
            {c.title || L('صورة', 'Photo')}
            {c.source !== 'neighborhood' && <span className="rounded bg-gold/20 px-2 py-0.5 text-xs font-semibold text-primary">{photoChip(c.source)}</span>}
          </h2>
          <PhotoGallery photos={[c.path]} alt={geoPhotoAlt(areaName, c.title, locale)} locale={locale} />
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        {updates.length === 0 && <p className="text-sm opacity-60">{t('noUpdates')}</p>}
        <ul className="space-y-2">
          {updates.map((u) => (
            <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${u.source === 'neighborhood' ? 'bg-graphite/10' : 'bg-gold/20 text-primary'}`}>
                  {sourceChip(u.source)}
                </span>
              </div>
              {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
              <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
              {u.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={u.photos} alt={geoPhotoAlt(areaName, u.title, locale)} locale={locale} /></div>}
            </li>
          ))}
        </ul>
      </section>

      {listingCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-primary">{t('listingsHere')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listingCards.map((c) => (
              <ListingCard key={c.id} href={c.href} cover={c.cover} title={c.title} subtitle={L(c.typeAr, c.typeEn)} price={c.price} currency={currency(locale)} />
            ))}
          </div>
        </section>
      )}
      </div>
    </SiteShell>
  );
}
