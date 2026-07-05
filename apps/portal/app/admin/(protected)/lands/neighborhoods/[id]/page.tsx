import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { loadUpdates, loadAreaMaps, loadAdjacency } from '../../geo';
import { amenitiesForNeighborhood } from '@/lib/amenities';

export const dynamic = 'force-dynamic';

export default async function NeighborhoodDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'VIEW');
  const { id } = await params;
  const n = await prisma.neighborhood.findUnique({ where: { id }, include: { district: true } });
  if (!n) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [siblings, advantages, amenities, maps, updates, adjacencyIds] = await Promise.all([
    prisma.neighborhood.findMany({ where: { districtId: n.districtId, id: { not: id } }, orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.advantage.findMany({ where: { neighborhoodId: id }, orderBy: { order: 'asc' } }),
    amenitiesForNeighborhood(id, n.districtId),
    loadAreaMaps('neighborhood', id),
    loadUpdates({ neighborhoodId: id }),
    loadAdjacency('neighborhood', id),
  ]);
  const adjacent = adjacencyIds.length
    ? await prisma.neighborhood.findMany({ where: { id: { in: adjacencyIds } }, include: { district: true } })
    : [];
  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L(n.district.nameAr, n.district.nameEn)} · {L(n.nameAr, n.nameEn)}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/lands/neighborhoods" className="text-sm text-accent">← {t('neighborhoods')}</a>
          <a href={`/admin/lands/neighborhoods/${id}/edit`} className="rounded-md bg-primary px-4 py-1.5 text-sm text-soft">{t('edit')}</a>
        </div>
      </div>

      {/* Cross-links: parent district + sibling neighborhoods */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="text-sm opacity-70">{t('district')}:</span>
        <a href={`/admin/lands/districts/${n.districtId}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(n.district.nameAr, n.district.nameEn)}</a>
        {siblings.length > 0 && <span className="ms-3 text-sm opacity-70">{t('neighborhoods')}:</span>}
        {siblings.map((s) => (
          <a key={s.id} href={`/admin/lands/neighborhoods/${s.id}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(s.nameAr, s.nameEn)}</a>
        ))}
      </section>

      {adjacent.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('adjacency')}</h2>
          <div className="flex flex-wrap gap-2">
            {adjacent.map((a) => (
              <a key={a.id} href={`/admin/lands/neighborhoods/${a.id}`} className="rounded-full border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">{L(a.district.nameAr, a.district.nameEn)} · {L(a.nameAr, a.nameEn)}</a>
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

      {amenities.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-primary">{t('publicRealm')}</h2>
          <ul className="space-y-2">
            {amenities.map((a) => (
              <li key={a.id} className="rounded-lg border border-graphite/15 p-3">
                {a.category && <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{locale === 'ar' ? a.category.ar : a.category.en || a.category.ar}</span>}
                <span className="ms-2 font-semibold">{locale === 'ar' ? a.titleAr : a.titleEn || a.titleAr}</span>
                {(a.detailsAr || a.detailsEn) && <p className="mt-1 whitespace-pre-wrap text-sm opacity-80">{locale === 'ar' ? a.detailsAr : a.detailsEn || a.detailsAr}</p>}
              </li>
            ))}
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
