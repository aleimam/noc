import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { loadUpdates, loadAreaMaps } from '../../geo';

export const dynamic = 'force-dynamic';

export default async function CityDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const city = await prisma.city.findUnique({ where: { id } });
  if (!city) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [districts, advantages, maps, updates] = await Promise.all([
    prisma.district.findMany({ where: { cityId: id }, orderBy: [{ order: 'asc' }, { nameAr: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.advantage.findMany({ where: { cityId: id }, orderBy: { order: 'asc' } }),
    loadAreaMaps('city', id),
    loadUpdates({ cityId: id }),
  ]);

  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
  const mapThumbs = [
    { map: maps.location, title: t('locationMap') },
    { map: maps.masterplan, title: t('masterplan') },
    { map: maps.services, title: t('servicesMap') },
    { map: maps.mainroads, title: t('mainRoadsMap') },
  ].filter((m) => m.map);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L(city.nameAr, city.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/lands/cities" className="text-sm text-accent">← {t('cities')}</a>
          <a href={`/admin/lands/cities/${id}/edit`} className="rounded-md bg-primary px-4 py-1.5 text-sm text-soft">{t('edit')}</a>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">{t('districts')} ({districts.length})</h2>
          <a href="/admin/lands/districts/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('addDistrict')}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          {districts.length === 0 && <span className="text-sm opacity-60">{t('noDistricts')}</span>}
          {districts.map((d) => (
            <a key={d.id} href={`/admin/lands/districts/${d.id}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(d.nameAr, d.nameEn)}</a>
          ))}
        </div>
      </section>

      {advantages.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('advantages')}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {advantages.map((a) => <li key={a.id}>{locale === 'ar' ? a.textAr : a.textEn || a.textAr}</li>)}
          </ul>
        </section>
      )}

      {mapThumbs.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('maps')}</h2>
          <div className="flex flex-wrap gap-3">
            {mapThumbs.map((m) => (
              <figure key={m.title} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.map!.clean} alt={m.title} className="h-28 w-40 rounded object-cover ring-1 ring-graphite/20" />
                <figcaption className="text-xs opacity-60">{m.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('updates')}</h2>
        {updates.length === 0 && <p className="text-sm opacity-60">{t('noUpdates')}</p>}
        <ul className="space-y-2">
          {updates.slice(0, 10).map((u) => (
            <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
              <div className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)}{u.author ? ` · ${u.author}` : ''}{u.notifiedAt ? ' · 📣' : ''}</div>
              {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
              <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
