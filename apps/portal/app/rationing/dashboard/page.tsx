import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SiteShell } from '../../_components/SiteShell';
import { getDashboardStats } from '../../../lib/rationing/stats';
import { getRationingConfig } from '../../../lib/rationing/settings';
import { Dashboard } from './Dashboard';
import { RationingTabs } from '../RationingTabs';

export const dynamic = 'force-dynamic';

export default async function RationingDashboard() {
  const config = await getRationingConfig();
  if (!config.showDashboard) notFound();

  const t = await getTranslations('rationing');
  const stats = await getDashboardStats();

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="pt-2 text-center">
          <h1 className="text-3xl font-black text-navy-800 sm:text-4xl">{t('dashboardTitle')}</h1>
          <p className="mt-2 text-lg text-ink-600">
            {t('dashboardSubtitle')}
            {stats.totals.latestListDate ? ` · ${t('latestList')}: ` : ''}
            {stats.totals.latestListDate && <span className="font-num" dir="ltr">{stats.totals.latestListDate}</span>}
          </p>
        </div>

        <RationingTabs active="analytics" showDashboard={config.showDashboard} />

        <Dashboard stats={stats} />
      </div>
    </SiteShell>
  );
}
