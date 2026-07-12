import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery, ListingCard } from '@noc/ui';
import { localizeUnit, currency, type Locale } from '@noc/i18n';
import { areaListings } from '../../../../lib/areaListings';
import { amenitiesForDistrict } from '../../../../lib/amenities';
import { getGeoInheritance, updatesForDistrict, customPhotosForDistrict } from '../../../../lib/geoInheritance';
import { SiteShell } from '../../../_components/SiteShell';
import { pageMeta, breadcrumbLd, ldJson } from '../../../../lib/seo';
import { geoPhotoAlt } from '../../../../lib/imageAlt';
import { districtHref, neighborhoodHref, resolveDistrictId } from '../../../../lib/geoHref';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: param } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const resolved = await resolveDistrictId(param);
  const d = resolved
    ? await prisma.district.findUnique({ where: { id: resolved.id }, select: { id: true, key: true, nameAr: true, nameEn: true, isActive: true } })
    : null;
  if (!d || !d.isActive) return { title: locale === 'en' ? 'Explore — New Obour' : 'استكشف — العبور الجديدة' };
  const name = locale === 'ar' ? d.nameAr : d.nameEn;
  return pageMeta({
    title: `${name} — ${locale === 'en' ? 'New Obour districts' : 'مناطق العبور الجديدة'}`,
    description: locale === 'en'
      ? `${name} in New Obour City: neighborhoods, advantages, public realm, maps and lands for sale.`
      : `${name} بمدينة العبور الجديدة: المجاورات والمميزات والمرافق والخرائط والأراضي المعروضة.`,
    path: districtHref(d),
    locale,
  });
}

export default async function DistrictPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const resolved = await resolveDistrictId(param);
  if (!resolved) notFound();
  const id = resolved.id;
  const d = await prisma.district.findUnique({
    where: { id },
    include: { neighborhoods: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  if (!d || !d.isActive) notFound();
  // Canonicalize: permanently redirect legacy cuids to the key-based SEO URL (308).
  if (decodeURIComponent(param) !== resolved.canonicalParam) permanentRedirect(districtHref(d));

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);
  const areaName = L(d.nameAr, d.nameEn); // for photo alt text (image SEO)

  const matrix = await getGeoInheritance();
  const [advantages, areaMaps, updates, amenityRows] = await Promise.all([
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    prisma.areaMap.findMany({ where: { level: 'district', areaId: id } }),
    // own updates + inherited city updates (per the inheritance matrix), source-tagged
    updatesForDistrict(id, d.cityId, matrix),
    amenitiesForDistrict(id),
  ]);
  const listingCards = await areaListings({ neighborhood: { districtId: id } });

  const fmt = (dt: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  const pickRow = (kind: string) => areaMaps.find((x) => x.kind === kind) ?? null;
  const locationRow = pickRow('location');
  let locationMap = locationRow ? locationRow.newobourPath || locationRow.cleanPath : null;
  let locationTitle = locationRow?.title ?? null;
  // Inherit the city's location map when the district has none of its own (matrix-gated).
  if (!locationMap && d.cityId && matrix.maps.cityToDistrict) {
    const cm = await prisma.areaMap.findFirst({
      where: { level: 'city', areaId: d.cityId, kind: 'location' },
      select: { newobourPath: true, cleanPath: true, title: true },
    });
    locationMap = cm?.newobourPath || cm?.cleanPath || null;
    locationTitle = cm?.title ?? null;
  }
  const masterplanRow = pickRow('masterplan');
  const masterplanMap = masterplanRow ? masterplanRow.newobourPath || masterplanRow.cleanPath : null;
  // Own custom photos + inherited city photos (additive, matrix-gated); own first.
  const customPhotos = await customPhotosForDistrict(id, d.cityId, matrix);
  const photoChip = (s: 'city' | 'district' | 'neighborhood') =>
    s === 'city' ? L('من المدينة', 'From the city') : s === 'district' ? L('من الحي', 'From the district') : '';

  // Owner decision (2026-07-11): the geo explorer — details, maps, advantages — is fully public.
  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: t('exploreTitle'), path: '/explore' },
    { name: L(d.nameAr, d.nameEn), path: districtHref(d) },
  ]);

  return (
    <SiteShell active="explore">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbsLd) }} />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
      <a href="/explore" className="text-sm text-accent">‹ {t('exploreTitle')}</a>
      <h1 className="text-2xl font-bold text-primary">{L(d.nameAr, d.nameEn)}</h1>

      {d.neighborhoods.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('neighborhoods')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.neighborhoods.map((n) => {
              const areas = (n.areas as number[] | null) ?? [];
              return (
                <a key={n.id} href={neighborhoodHref({ id: n.id, nameAr: n.nameAr, district: { nameAr: d.nameAr } })} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                  <div className="font-semibold">{L(n.nameAr, n.nameEn)}</div>
                  <div className="mt-1 text-xs opacity-70">{n.assortedAreas ? t('assorted') : areas.length ? `${areas.join(locale === 'ar' ? '، ' : ', ')} ${m2}` : '—'}</div>
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

      {/* Extra branded photos: this district's own + inherited from the city (additive). */}
      {customPhotos.map((c) => (
        <section key={c.kind} className="space-y-2">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold text-primary">
            {c.title || L('صورة', 'Photo')}
            {c.source !== 'district' && <span className="rounded bg-gold/20 px-2 py-0.5 text-xs font-semibold text-primary">{photoChip(c.source)}</span>}
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
                {u.source === 'city' && (
                  <span className="rounded bg-gold/20 px-2 py-0.5 text-xs font-semibold text-primary">{L('من المدينة', 'From the city')}</span>
                )}
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
