import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../_components/SiteShell';
import { localizeUnit } from '@noc/i18n';
import { pageMeta } from '../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Explore districts & neighborhoods — New Obour' : 'استكشف المناطق والمجاورات — العبور الجديد',
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

  const districts = await prisma.district.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { city: true, neighborhoods: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  const withNb = districts.filter((d) => d.neighborhoods.length > 0);

  // Group districts under their city (City → District → Neighborhood). Districts with no
  // city (shouldn't happen after backfill) fall into an unlabeled bucket at the end.
  type City = { id: string; nameAr: string; nameEn: string } | null;
  const groups: { city: City; districts: typeof withNb }[] = [];
  const idx = new Map<string, number>();
  for (const d of withNb) {
    const key = d.city?.id ?? '_none';
    if (!idx.has(key)) {
      idx.set(key, groups.length);
      groups.push({ city: d.city ? { id: d.city.id, nameAr: d.city.nameAr, nameEn: d.city.nameEn } : null, districts: [] });
    }
    groups[idx.get(key)!]!.districts.push(d);
  }

  return (
    <SiteShell active="explore">
      <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-800">{t('exploreTitle')}</h1>
        <p className="text-sm text-ink-500">{t('exploreManage')}</p>
      </div>

      {withNb.length === 0 && <p className="py-12 text-center opacity-60">{t('noNeighborhoods')}</p>}

      {groups.map((g, gi) => (
        <div key={g.city?.id ?? gi} className="space-y-6">
          {g.city && (
            <h2 className="border-b border-graphite/15 pb-1 text-xl font-extrabold text-primary">
              <a href={`/explore/city/${g.city.id}`} className="hover:text-accent hover:underline">{L(g.city.nameAr, g.city.nameEn)}</a>
            </h2>
          )}
          {g.districts.map((d) => (
            <section key={d.id} className="space-y-3">
              <h3 className="text-lg font-bold text-primary">
                <a href={`/explore/district/${d.id}`} className="hover:text-accent hover:underline">{L(d.nameAr, d.nameEn)}</a>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {d.neighborhoods.map((n) => {
                  const areas = (n.areas as number[] | null) ?? [];
                  return (
                    <a key={n.id} href={`/explore/${n.id}`} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                      <div className="font-semibold">{L(n.nameAr, n.nameEn)}</div>
                      <div className="mt-1 text-xs opacity-70">
                        {n.assortedAreas ? t('assorted') : areas.length ? `${areas.join('، ')} ${m2}` : '—'}
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
