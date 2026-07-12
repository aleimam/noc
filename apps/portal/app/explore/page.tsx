import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../_components/SiteShell';
import { localizeUnit } from '@noc/i18n';
import { pageMeta } from '../../lib/seo';
import { SeoIntro } from '../_components/SeoText';
import { getSeoIntro } from '../../lib/seoContent';
import { cityHref, districtHref, neighborhoodHref } from '../../lib/geoHref';
import { GeoTree, type TreeCity } from './GeoTree';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Explore districts & neighborhoods — New Obour' : 'استكشف المناطق والمجاورات — العبور الجديدة',
    description: locale === 'en' ? 'Browse New Obour City districts and neighborhoods: plot areas, advantages, public realm, maps and lands for sale.' : 'تصفّح مناطق ومجاورات مدينة العبور الجديدة: مساحات القطع والمميزات والمرافق والخرائط والأراضي المعروضة.',
    path: '/explore',
    locale,
  });
}

export default async function ExplorePage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);
  const intro = await getSeoIntro('explore', locale);

  const districts = await prisma.district.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { city: true, neighborhoods: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  const withNb = districts.filter((d) => d.neighborhoods.length > 0);

  // Group districts under their city (City → District → Neighborhood). Districts with no
  // city (shouldn't happen after backfill) fall into an unlabeled bucket at the end.
  type City = { id: string; nameAr: string; nameEn: string; href: string } | null;
  const groups: { city: City; districts: typeof withNb }[] = [];
  const idx = new Map<string, number>();
  for (const d of withNb) {
    const key = d.city?.id ?? '_none';
    if (!idx.has(key)) {
      idx.set(key, groups.length);
      groups.push({ city: d.city ? { id: d.city.id, nameAr: d.city.nameAr, nameEn: d.city.nameEn, href: cityHref(d.city) } : null, districts: [] });
    }
    groups[idx.get(key)!]!.districts.push(d);
  }

  // Family-tree data: ALL active districts (even without neighborhoods) grouped by city.
  // Hrefs are prebuilt server-side (canonical SEO URLs) — GeoTree is a client component
  // and must not build geo URLs itself.
  const treeCities: TreeCity[] = [];
  {
    const tIdx = new Map<string, number>();
    for (const d of districts) {
      if (!d.city) continue;
      if (!tIdx.has(d.city.id)) {
        tIdx.set(d.city.id, treeCities.length);
        treeCities.push({ id: d.city.id, nameAr: d.city.nameAr, nameEn: d.city.nameEn, href: cityHref(d.city), districts: [] });
      }
      treeCities[tIdx.get(d.city.id)!]!.districts.push({
        id: d.id,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        href: districtHref(d),
        neighborhoods: d.neighborhoods.map((n) => ({ id: n.id, nameAr: n.nameAr, nameEn: n.nameEn, href: neighborhoodHref({ id: n.id, nameAr: n.nameAr, district: { nameAr: d.nameAr } }) })),
      });
    }
  }

  return (
    <SiteShell active="explore">
      <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold text-navy-800">{t('exploreTitle')}</h1>
        <p className="text-sm text-ink-500">{t('exploreManage')}</p>
        <SeoIntro text={intro} />
      </div>

      <GeoTree cities={treeCities} locale={locale} />

      {withNb.length === 0 && <p className="py-12 text-center opacity-60">{t('noNeighborhoods')}</p>}

      {groups.map((g, gi) => (
        <div key={g.city?.id ?? gi} className="space-y-6">
          {g.city && (
            <h2 className="border-b border-graphite/15 pb-1 text-xl font-extrabold text-primary">
              <a href={g.city.href} className="hover:text-accent hover:underline">{L(g.city.nameAr, g.city.nameEn)}</a>
            </h2>
          )}
          {g.districts.map((d) => (
            <section key={d.id} className="space-y-3">
              <h3 className="text-lg font-bold text-primary">
                <a href={districtHref(d)} className="hover:text-accent hover:underline">{L(d.nameAr, d.nameEn)}</a>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {d.neighborhoods.map((n) => {
                  const areas = (n.areas as number[] | null) ?? [];
                  return (
                    <a key={n.id} href={neighborhoodHref({ id: n.id, nameAr: n.nameAr, district: { nameAr: d.nameAr } })} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                      <div className="font-semibold">{L(n.nameAr, n.nameEn)}</div>
                      <div className="mt-1 text-xs opacity-70">
                        {n.assortedAreas ? t('assorted') : areas.length ? `${areas.join(locale === 'ar' ? '، ' : ', ')} ${m2}` : '—'}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ))}
      </div>
    </SiteShell>
  );
}
