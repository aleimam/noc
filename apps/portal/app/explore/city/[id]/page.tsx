import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PhotoGallery } from '@noc/ui';
import { SiteShell } from '../../../_components/SiteShell';
import { updatesForCity } from '../../../../lib/geoInheritance';
import { pageMeta, breadcrumbLd, ldJson } from '../../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const c = await prisma.city.findUnique({ where: { id }, select: { nameAr: true, nameEn: true, isActive: true } });
  if (!c || !c.isActive) return { title: locale === 'en' ? 'Explore — New Obour' : 'استكشف — العبور الجديد' };
  const name = locale === 'ar' ? c.nameAr : c.nameEn;
  return pageMeta({
    title: `${name} — ${locale === 'en' ? 'New Obour' : 'العبور الجديد'}`,
    description: locale === 'en'
      ? `${name}: masterplan, location, services and main-roads maps, city advantages and districts.`
      : `${name}: المخطط العام والموقع وخرائط الخدمات والمحاور، ومميزات المدينة وأحياؤها.`,
    path: `/explore/city/${id}`,
    locale,
  });
}

export default async function CityPublic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const city = await prisma.city.findUnique({
    where: { id },
    include: {
      advantages: { orderBy: { order: 'asc' } },
      districts: { where: { isActive: true }, orderBy: { order: 'asc' } },
    },
  });
  if (!city || !city.isActive) notFound();

  const [maps, updates] = await Promise.all([
    prisma.areaMap.findMany({ where: { level: 'city', areaId: id } }),
    updatesForCity(id),
  ]);
  const pick = (kind: string) => {
    const r = maps.find((x) => x.kind === kind);
    return r ? r.newobourPath || r.cleanPath : null;
  };
  const fmt = (dt: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  // Owner decision (2026-07-11): the geo explorer — details, maps, advantages — is fully public.
  const mapSections: { key: string; label: string }[] = [
    { key: 'masterplan', label: t('masterplan') },
    { key: 'location', label: t('locationMap') },
    { key: 'services', label: t('servicesMap') },
    { key: 'mainroads', label: t('mainRoadsMap') },
  ];

  const crumbsLd = breadcrumbLd([
    { name: L('الرئيسية', 'Home'), path: '/' },
    { name: t('exploreTitle'), path: '/explore' },
    { name: L(city.nameAr, city.nameEn), path: `/explore/city/${city.id}` },
  ]);

  return (
    <SiteShell active="explore">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbsLd) }} />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <a href="/explore" className="text-sm text-accent">‹ {t('exploreTitle')}</a>
        <h1 className="text-2xl font-bold text-primary">{L(city.nameAr, city.nameEn)}</h1>

        {city.advantages.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold text-primary">{t('advantages')}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {city.advantages.map((a) => (
                <li key={a.id}>{locale === 'ar' ? a.textAr : a.textEn || a.textAr}</li>
              ))}
            </ul>
          </section>
        )}

        {mapSections.map((m) => {
          const src = pick(m.key);
          if (!src) return null;
          return (
            <section key={m.key} className="space-y-2">
              <h2 className="font-semibold text-primary">{m.label}</h2>
              <PhotoGallery photos={[src]} />
            </section>
          );
        })}

        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('updates')}</h2>
          {updates.length === 0 && <p className="text-sm opacity-60">{t('noUpdates')}</p>}
          <ul className="space-y-2">
            {updates.map((u) => (
              <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
                <div className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)}</div>
                {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
                <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
                {u.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={u.photos} /></div>}
              </li>
            ))}
          </ul>
        </section>

        {city.districts.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold text-primary">{t('districts')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {city.districts.map((d) => (
                <a key={d.id} href={`/explore/district/${d.id}`} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                  <div className="font-semibold">{L(d.nameAr, d.nameEn)}</div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
