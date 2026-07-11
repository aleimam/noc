import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { loadUpdates, loadAreaMaps, loadAdjacency } from '../../geo';

export const dynamic = 'force-dynamic';

export default async function DistrictDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const district = await prisma.district.findUnique({ where: { id } });
  if (!district) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [neighborhoods, advantages, maps, updates, adjacencyIds] = await Promise.all([
    prisma.neighborhood.findMany({ where: { districtId: id }, orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.advantage.findMany({ where: { districtId: id }, orderBy: { order: 'asc' } }),
    loadAreaMaps('district', id),
    loadUpdates({ districtId: id }),
    loadAdjacency('district', id),
  ]);
  const adjacent = adjacencyIds.length
    ? await prisma.district.findMany({ where: { id: { in: adjacencyIds } }, select: { id: true, nameAr: true, nameEn: true } })
    : [];

  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L(district.nameAr, district.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/lands/districts" className="text-sm text-accent">← {t('districts')}</a>
          <a href={`/admin/lands/districts/${id}/edit`} className="rounded-md bg-primary px-4 py-1.5 text-sm text-soft">{t('edit')}</a>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">{t('neighborhoods')} ({neighborhoods.length})</h2>
          <a href={`/admin/lands/neighborhoods/new?district=${id}`} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('addNeighborhood')}</a>
        </div>
        <div className="flex flex-wrap gap-2">
          {neighborhoods.length === 0 && <span className="text-sm opacity-60">{t('noNeighborhoods')}</span>}
          {neighborhoods.map((n) => (
            <a key={n.id} href={`/admin/lands/neighborhoods/${n.id}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(n.nameAr, n.nameEn)}</a>
          ))}
        </div>
      </section>

      {adjacent.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('adjacency')}</h2>
          <div className="flex flex-wrap gap-2">
            {adjacent.map((d) => (
              <a key={d.id} href={`/admin/lands/districts/${d.id}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(d.nameAr, d.nameEn)}</a>
            ))}
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

      {(maps.location || maps.masterplan) && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('locationMap')} / {t('masterplan')}</h2>
          <div className="flex flex-wrap gap-3">
            {maps.location && /* eslint-disable-next-line @next/next/no-img-element */ <img src={maps.location.clean} alt={t('locationMap')} className="h-28 w-40 rounded object-cover ring-1 ring-graphite/20" />}
            {maps.masterplan && /* eslint-disable-next-line @next/next/no-img-element */ <img src={maps.masterplan.clean} alt={t('masterplan')} className="h-28 w-40 rounded object-cover ring-1 ring-graphite/20" />}
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
