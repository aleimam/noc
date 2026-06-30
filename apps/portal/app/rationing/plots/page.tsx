import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';
import { RationingTabs } from '../RationingTabs';
import { ListControls } from '../ListControls';
import { FbNotice } from '../Bits';
import { plotGroups, plotsSummary } from '../../../lib/rationing/search';
import { getRationingConfig } from '../../../lib/rationing/settings';

export const dynamic = 'force-dynamic';
const PER = [10, 25, 50];
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '').trim();

export default async function PlotsTab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = await getTranslations('rationing');
  const config = await getRationingConfig();
  const q = str(sp.q);
  const cityId = str(sp.city);
  const per = PER.includes(parseInt(str(sp.per), 10)) ? parseInt(str(sp.per), 10) : 10;
  const sort = (str(sp.sort) === 'plot' ? 'plot' : 'count') as 'plot' | 'count';
  const page = Math.max(1, parseInt(str(sp.page) || '1', 10) || 1);

  const active = q.length > 0 || cityId.length > 0;
  const cities = await prisma.rationingCity.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } });
  const cityName = cityId ? cities.find((c) => c.id === cityId)?.name ?? null : null;

  const { rows, total } = active ? await plotGroups({ q, cityId: cityId || undefined, sort, take: per, skip: (page - 1) * per }) : { rows: [], total: 0 };
  const summary = active ? null : await plotsSummary();

  const totalPages = Math.ceil(total / per);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cityId) params.set('city', cityId);
    if (per !== 10) params.set('per', String(per));
    if (sort !== 'count') params.set('sort', sort);
    params.set('page', String(p));
    return `/rationing/plots?${params.toString()}`;
  };

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <FbNotice />
        <h1 className="pt-1 text-center text-3xl font-black text-navy-800 dark:text-soft">{t('plotsTitle')}</h1>
        <RationingTabs active="plots" showDashboard={config.showDashboard} />

        <form method="get" className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-md" style={{ minHeight: 64 }}>
          <input name="q" defaultValue={q} placeholder={t('plotsSearchPh')} className="flex-1 bg-transparent px-3 text-xl text-navy-800 outline-none" />
          <button className="rounded-xl bg-gold px-7 py-3 text-lg font-bold text-navy-900">{t('search')}</button>
        </form>

        {/* Fast city filters */}
        {cities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-sm text-ink-500">{t('fastFilters')}:</span>
            <Link href="/rationing/plots" className={`rounded-full px-4 py-1.5 text-base ${!cityId ? 'bg-navy text-soft' : 'border border-ink-200 text-navy-700'}`}>{t('allCities')}</Link>
            {cities.map((c) => (
              <Link key={c.id} href={`/rationing/plots?city=${c.id}`} className={`rounded-full px-4 py-1.5 text-base ${cityId === c.id ? 'bg-navy text-soft' : 'border border-ink-200 text-navy-700'}`}>
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {!active && summary && (
          <>
            {/* Totals + by-city card */}
            <div className="rounded-3xl bg-navy-800 p-6 text-white">
              <div className="text-center text-base text-navy-200">{t('totalsTitle')}</div>
              <div className="mt-3 text-center">
                <div className="font-num text-4xl font-black text-gold">{summary.totalPlots.toLocaleString('en')}</div>
                <div className="mt-1 text-sm text-navy-200">{t('plotsTitle')}</div>
              </div>
              {summary.byCity.length > 0 && (
                <div className="mt-4 space-y-2">
                  {summary.byCity.map((b) => (
                    <div key={b.label} className="flex items-center gap-3">
                      <div className="w-28 flex-none truncate text-sm text-navy-200">{b.label}</div>
                      <div className="relative h-5 flex-1 rounded-md bg-white/10">
                        <div className="h-5 rounded-md bg-gold" style={{ width: `${Math.max(4, (b.value / summary.byCity[0]!.value) * 100)}%` }} />
                      </div>
                      <div className="w-12 flex-none font-num text-sm font-bold">{b.value.toLocaleString('en')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent plots */}
            {summary.recent.length > 0 && (
              <div>
                <h2 className="mb-2 text-lg font-bold text-navy-800 dark:text-soft">{t('recentPlots')}</h2>
                <div className="flex flex-col gap-2.5">
                  {summary.recent.map((r) => (
                    <Link key={r.ref} href={`/rationing/plot?ref=${encodeURIComponent(r.ref)}`} className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-gold hover:shadow-md">
                      <div className="min-w-0 flex-1">
                        <div className="font-num text-xl font-bold text-navy-800 dark:text-soft">{r.ref}</div>
                        <div className="mt-0.5 truncate text-sm text-ink-600">{r.cityName ?? '—'} · {t('colApplicantsCount')}: <span className="font-num">{r.count}</span></div>
                      </div>
                      <span className="flex-none text-2xl text-gold" aria-hidden>‹</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {active && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-base text-ink-500">{cityName ? `${cityName} · ` : ''}{t('resultsN', { n: total })}</span>
              <ListControls defaultSort="count" sortOptions={[{ value: 'count', label: t('sortMostApplicants') }, { value: 'plot', label: t('sortPlot') }]} />
            </div>

            {rows.length === 0 ? (
              <p className="py-12 text-center text-ink-500">{t('noMatches')}</p>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <table className="w-full text-base">
                  <thead className="bg-navy-50 text-navy-700">
                    <tr>
                      <th className="p-3 text-start">{t('colPlot')}</th>
                      <th className="p-3 text-start">{t('colCity')}</th>
                      <th className="p-3 text-start">{t('colOwner')}</th>
                      <th className="p-3 text-start">{t('colApplicantsCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.ref} className="border-t border-ink-100 hover:bg-navy-50/40">
                        <td className="p-3"><Link href={`/rationing/plot?ref=${encodeURIComponent(r.ref)}`} className="font-bold text-navy-700 hover:text-gold-700">{r.ref}</Link></td>
                        <td className="p-3">{r.cityName ?? '—'}</td>
                        <td className="p-3">{r.owner ?? '—'}</td>
                        <td className="p-3 font-num font-bold">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('prev')}</Link>}
                <span className="text-ink-500">{t('pageOf', { page, total: totalPages })}</span>
                {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('next')}</Link>}
              </div>
            )}
          </>
        )}
      </div>
    </SiteShell>
  );
}
