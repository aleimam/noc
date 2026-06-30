'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Bar, DashboardStats } from '../../../lib/rationing/stats';

function BarList({ bars, color, max }: { bars: Bar[]; color: string; max?: number }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  if (bars.length === 0) return <p className="py-6 text-center text-sm text-ink-400">—</p>;
  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-28 flex-none truncate text-sm text-ink-700" title={b.label}>{b.label}</div>
          <div className="relative h-6 flex-1 rounded-md bg-ink-100">
            <div className="h-6 rounded-md transition-all" style={{ width: `${Math.max(3, (b.value / top) * 100)}%`, background: color }} title={`${b.value}`} />
          </div>
          <div className="w-12 flex-none text-start font-num text-sm font-bold text-navy-800">{b.value.toLocaleString('en')}</div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-md">
      <h2 className="mb-4 text-lg font-bold text-navy-800">{title}</h2>
      {children}
    </section>
  );
}

export function Dashboard({ stats }: { stats: DashboardStats }) {
  const t = useTranslations('rationing');
  const [ownerLimit, setOwnerLimit] = useState(10);

  const cards: { label: string; value: string | number }[] = [
    { label: t('statApplicants'), value: stats.totals.applicants.toLocaleString('en') },
    { label: t('statPlots'), value: stats.totals.plots.toLocaleString('en') },
    { label: t('statOwners'), value: stats.totals.owners.toLocaleString('en') },
    { label: t('statCities'), value: stats.totals.cities.toLocaleString('en') },
    { label: t('statBatches'), value: stats.totals.batches.toLocaleString('en') },
    { label: t('statScanCoverage'), value: `${stats.totals.scanCoveragePct}%` },
  ];

  const declTotal = stats.declarations.required + stats.declarations.notRequired;
  const declPct = declTotal ? Math.round((stats.declarations.required / declTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs text-ink-500">{c.label}</div>
            <div className="font-num text-2xl font-black text-navy-800">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('chartByCity')}>
          <BarList bars={stats.byCity} color="#0b1b33" />
        </Panel>

        <Panel title={t('chartDeclarations')}>
          <div className="flex items-center gap-4">
            <div className="relative h-28 w-28 flex-none rounded-full" style={{ background: `conic-gradient(#c9983e 0% ${declPct}%, #eef2f8 ${declPct}% 100%)` }}>
              <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white">
                <span className="font-num text-xl font-black text-navy-800">{declPct}%</span>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-gold" /> {t('declRequired')}: <b className="font-num">{stats.declarations.required.toLocaleString('en')}</b></div>
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-navy-100" /> {t('declNot')}: <b className="font-num">{stats.declarations.notRequired.toLocaleString('en')}</b></div>
            </div>
          </div>
        </Panel>

        <Panel title={t('chartByDay')}>
          <BarList bars={stats.byDay} color="#1c3a63" />
        </Panel>

        <Panel title={t('chartByMonth')}>
          <BarList bars={stats.byMonth} color="#2a4d7d" />
        </Panel>
      </div>

      <Panel title={t('chartTopOwners')}>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-ink-500">{t('show')}:</span>
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              onClick={() => setOwnerLimit(n)}
              className={`rounded-lg px-3 py-1 ${ownerLimit === n ? 'bg-navy text-soft' : 'bg-ink-100 text-ink-700'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <BarList bars={stats.topOwners.slice(0, ownerLimit)} color="#c9983e" />
      </Panel>
    </div>
  );
}
