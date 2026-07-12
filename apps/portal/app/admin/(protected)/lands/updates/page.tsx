import { requirePermission } from '@noc/auth';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { UpdatesManager } from './UpdatesManager';

export const dynamic = 'force-dynamic';

export default async function UpdatesSection() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [cities, districts, neighborhoods, ups] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.district.findMany({ orderBy: [{ order: 'asc' }], select: { id: true, nameAr: true, nameEn: true } }),
    prisma.neighborhood.findMany({ orderBy: [{ order: 'asc' }], include: { district: true } }),
    prisma.geoUpdate.findMany({
      where: { OR: [{ cityId: { not: null } }, { districtId: { not: null } }, { neighborhoodId: { not: null } }] },
      orderBy: { happenedAt: 'desc' },
      take: 200,
      include: { city: true, district: true, neighborhood: { include: { district: true } }, createdBy: { select: { name: true, email: true } } },
    }),
  ]);

  const targets = {
    city: cities.map((c) => ({ value: c.id, label: L(c.nameAr, c.nameEn) })),
    district: districts.map((d) => ({ value: d.id, label: L(d.nameAr, d.nameEn) })),
    neighborhood: neighborhoods.map((n) => ({ value: n.id, label: `${L(n.district.nameAr, n.district.nameEn)} · ${L(n.nameAr, n.nameEn)}` })),
  };
  const rows = ups.map((u) => ({
    id: u.id,
    title: u.title,
    body: u.body,
    happenedAt: u.happenedAt.toISOString(),
    notifiedAt: u.notifiedAt ? u.notifiedAt.toISOString() : null,
    author: u.createdBy?.name ?? u.createdBy?.email ?? null,
    isCity: !!u.city,
    area: u.city
      ? `${L('مدينة', 'City')} · ${L(u.city.nameAr, u.city.nameEn)}`
      : u.district
        ? L(u.district.nameAr, u.district.nameEn)
        : u.neighborhood
          ? `${L(u.neighborhood.district.nameAr, u.neighborhood.district.nameEn)} · ${L(u.neighborhood.nameAr, u.neighborhood.nameEn)}`
          : '—',
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('updatesSection')}</h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <UpdatesManager targets={targets} rows={rows} locale={locale} />
    </div>
  );
}
