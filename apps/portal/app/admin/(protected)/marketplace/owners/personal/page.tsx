import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

// The shared pool of PERSONAL owners (فرد) — they carry no allocated code and number
// from the 800–999 monthly ad pool. Each links to its own owner detail page.
export default async function PersonalOwnersPage() {
  await requirePermission('marketplace', 'VIEW');
  const t = await getTranslations('mp');
  const owners = await prisma.owner.findMany({
    where: { type: 'PERSONAL' },
    orderBy: { name: 'asc' },
    include: { _count: { select: { listings: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('personalOwners')} ({owners.length})</h1>
        <a href="/admin/marketplace/owners" className="text-sm text-accent">← {t('backToOwners')}</a>
      </div>
      {owners.length === 0 ? (
        <p className="text-sm opacity-60">{t('ownerNothing')}</p>
      ) : (
        <ul className="divide-y divide-graphite/10 rounded-lg border border-graphite/15">
          {owners.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <a href={`/admin/marketplace/owners/${o.id}`} className="font-medium text-accent hover:underline">{o.name}</a>
              <span className="flex items-center gap-3 whitespace-nowrap opacity-70">
                {o.phone1 && <span dir="ltr">{o.phone1}</span>}
                <span>{o._count.listings} {t('ownerListings')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
