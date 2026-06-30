import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PublicShell } from '@noc/ui';
import { getDashboardStats } from '../../../lib/rationing/stats';
import { getRationingConfig } from '../../../lib/rationing/settings';
import { Dashboard } from './Dashboard';

export const dynamic = 'force-dynamic';

export default async function RationingDashboard() {
  const config = await getRationingConfig();
  if (!config.showDashboard) notFound();

  const t = await getTranslations('rationing');
  const stats = await getDashboardStats();

  return (
    <PublicShell active="rationing">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-navy-800 sm:text-4xl">{t('dashboardTitle')}</h1>
            <p className="mt-2 text-lg text-ink-600">
              {t('dashboardSubtitle')}
              {stats.totals.latestListDate ? ` · ${t('latestList')}: ` : ''}
              {stats.totals.latestListDate && <span className="font-num" dir="ltr">{stats.totals.latestListDate}</span>}
            </p>
          </div>
          <Link href="/rationing" className="rounded-xl bg-gold px-5 py-2.5 font-bold text-navy-900">{t('search')}</Link>
        </div>

        <Dashboard stats={stats} />
      </div>
    </PublicShell>
  );
}
