import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SiteShell } from '../../_components/SiteShell';
import { RationingTabs } from '../RationingTabs';
import { ListControls } from '../ListControls';
import { plotGroups } from '../../../lib/rationing/search';
import { getRationingConfig } from '../../../lib/rationing/settings';

export const dynamic = 'force-dynamic';
const PER = [10, 25, 50];
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '').trim();

export default async function PlotsTab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = await getTranslations('rationing');
  const config = await getRationingConfig();
  const q = str(sp.q);
  const per = PER.includes(parseInt(str(sp.per), 10)) ? parseInt(str(sp.per), 10) : 10;
  const sort = (str(sp.sort) === 'plot' ? 'plot' : 'count') as 'plot' | 'count';
  const page = Math.max(1, parseInt(str(sp.page) || '1', 10) || 1);

  const { rows, total } = await plotGroups({ q, sort, take: per, skip: (page - 1) * per });
  const totalPages = Math.ceil(total / per);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (per !== 10) params.set('per', String(per));
    if (sort !== 'count') params.set('sort', sort);
    params.set('page', String(p));
    return `/rationing/plots?${params.toString()}`;
  };

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <h1 className="pt-2 text-center text-3xl font-black text-navy-800">{t('plotsTitle')}</h1>
        <RationingTabs active="plots" showDashboard={config.showDashboard} />

        <form method="get" className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-md">
          <input name="q" defaultValue={q} placeholder={t('plotsSearchPh')} className="flex-1 bg-transparent px-3 text-lg text-navy-800 outline-none" />
          <button className="rounded-xl bg-gold px-6 py-2.5 font-bold text-navy-900">{t('search')}</button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink-500">{t('resultsN', { n: total })}</span>
          <ListControls defaultSort="count" sortOptions={[{ value: 'count', label: t('sortMostApplicants') }, { value: 'plot', label: t('sortPlot') }]} />
        </div>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-ink-500">{t('noMatches')}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
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
                    <td className="p-3">
                      <Link href={`/rationing/plot?ref=${encodeURIComponent(r.ref)}`} className="font-bold text-navy-700 hover:text-gold-700">{r.ref}</Link>
                    </td>
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
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('prev')}</Link>}
            <span className="text-ink-500">{t('pageOf', { page, total: totalPages })}</span>
            {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('next')}</Link>}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
