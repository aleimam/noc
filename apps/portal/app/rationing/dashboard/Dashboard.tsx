'use client';

import { useTranslations } from 'next-intl';
import type { Bar, DashboardStats } from '../../../lib/rationing/stats';

function BarList({ bars, color }: { bars: Bar[]; color: string }) {
  const top = Math.max(1, ...bars.map((b) => b.value));
  if (bars.length === 0) return <p className="py-6 text-center text-sm text-ink-400">—</p>;
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-28 flex-none truncate text-sm text-ink-700" title={b.label}>{b.label}</div>
          <div className="relative h-6 flex-1 rounded-md bg-ink-100">
            <div className="h-6 rounded-md transition-all" style={{ width: `${Math.max(3, (b.value / top) * 100)}%`, background: color }} />
          </div>
          <div className="w-12 flex-none text-start font-num text-sm font-bold text-navy-800 dark:text-soft">{b.value.toLocaleString('en')}</div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-md">
      <h2 className="mb-4 text-lg font-bold text-navy-800 dark:text-soft">{title}</h2>
      {children}
    </section>
  );
}

export function Dashboard({ stats }: { stats: DashboardStats }) {
  const t = useTranslations('rationing');

  const cards: { label: string; value: string | number }[] = [
    { label: t('statApplicants'), value: stats.totals.owners.toLocaleString('en') },
    { label: t('statPlots'), value: stats.totals.plots.toLocaleString('en') },
    { label: t('statCities'), value: stats.totals.cities.toLocaleString('en') },
    { label: t('avgOwnersPerPlot'), value: stats.totals.avgOwnersPerPlot.toLocaleString('en') },
    { label: t('latestList'), value: stats.totals.latestListDate ?? '—' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs text-ink-500">{c.label}</div>
            <div className="font-num text-2xl font-black text-navy-800 dark:text-soft" dir="ltr">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('chartByCity')}>
          <BarList bars={stats.byCity} color="#0b1b33" />
        </Panel>
        <Panel title={t('chartByMonth')}>
          <BarList bars={stats.byMonth} color="#2a4d7d" />
        </Panel>
      </div>

      <Panel title={t('busiestPlots')}>
        <BarList bars={stats.busiestPlots} color="#c9983e" />
      </Panel>
    </div>
  );
}
