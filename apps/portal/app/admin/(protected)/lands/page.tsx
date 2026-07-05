import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function LandsHub() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const [districts, neighborhoods, blocks, follows, updates] = await Promise.all([
    prisma.district.count(),
    prisma.neighborhood.count(),
    prisma.block.count(),
    prisma.landFollow.count(),
    prisma.geoUpdate.count({ where: { OR: [{ districtId: { not: null } }, { neighborhoodId: { not: null } }] } }),
  ]);

  // Land plots live in their own top-level section now; this hub is the geographic DB.
  const links = [
    { href: '/admin/lands/districts', label: t('districts'), count: districts },
    { href: '/admin/lands/neighborhoods', label: t('neighborhoods'), count: neighborhoods },
    { href: '/admin/lands/updates', label: t('updates'), count: updates },
    { href: '/admin/lands/amenities', label: t('amenityLibrary'), count: null },
    { href: '/admin/lands/follows', label: t('follows'), count: follows },
  ];
  const stats = [{ label: t('blocks'), count: blocks }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="text-sm opacity-70">{t('manage')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((c) => (
          <a key={c.href} href={c.href} className="rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <div className="text-3xl font-bold text-primary">{c.count ?? '⚙'}</div>
            <div className="mt-1 text-sm opacity-80">{c.label}</div>
          </a>
        ))}
        {stats.map((c) => (
          <div key={c.label} className="rounded-lg border border-graphite/15 p-5">
            <div className="text-3xl font-bold text-primary">{c.count}</div>
            <div className="mt-1 text-sm opacity-60">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
