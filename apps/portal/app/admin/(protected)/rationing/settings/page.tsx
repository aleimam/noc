import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { getRationingConfig } from '../../../../../lib/rationing/settings';
import { CitiesManager } from './CitiesManager';
import { ContentEditor } from './ContentEditor';

export const dynamic = 'force-dynamic';

export default async function RationingSettingsPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');

  const [cityRows, config] = await Promise.all([
    prisma.rationingCity.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { sheets: true } } },
    }),
    getRationingConfig(),
  ]);

  const cities = cityRows.map((c) => ({
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    order: c.order,
    isActive: c.isActive,
    count: c._count.sheets,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsTitle')}</h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('citiesTitle')}</h2>
        <p className="text-sm opacity-70">{t('citiesHint')}</p>
        <CitiesManager cities={cities} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('contentTitle')}</h2>
        <p className="text-sm opacity-70">{t('contentHint')}</p>
        <ContentEditor config={config} />
      </section>
    </div>
  );
}
