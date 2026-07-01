import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function RationingHub() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');

  const [sheets, inquiries, searches, cities, scans, review, dupGroups] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.inquiryRequest.count({ where: { status: 'OPEN' } }),
    prisma.sheetSearchLog.count(),
    prisma.rationingCity.count(),
    prisma.rationingScan.count(),
    prisma.rationingSheet.count({ where: { needsReview: true } }),
    prisma.rationingSheet.groupBy({ by: ['dedupeKey'], _count: { _all: true }, having: { dedupeKey: { _count: { gt: 1 } } } }),
  ]);
  const cards = [
    { href: '/admin/rationing/sheets', label: t('sheets'), count: sheets },
    { href: '/admin/rationing/scans', label: t('scansTitle'), count: scans },
    { href: '/admin/rationing/review', label: t('reviewTitle'), count: review },
    { href: '/admin/rationing/duplicates', label: t('duplicatesTitle'), count: dupGroups.length },
    { href: '/admin/rationing/inquiries', label: t('inquiries'), count: inquiries },
    { href: '/admin/rationing/searches', label: t('searches'), count: searches },
    { href: '/admin/rationing/settings', label: t('settingsTitle'), count: cities },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="text-sm opacity-70">{t('manage')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <div className="text-3xl font-bold text-primary">{c.count}</div>
            <div className="mt-1 text-sm opacity-80">{c.label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
