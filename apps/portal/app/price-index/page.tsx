import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { SiteShell } from '../_components/SiteShell';
import { localizeUnit } from '@noc/i18n';
import { pageMeta } from '../../lib/seo';
import { computeDistrictPrices, loadTrends, currentMonth, type TrendPoint } from '../../lib/priceIndex';
import { Spark } from './Spark';
import { PriceCompare } from './PriceCompare';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Land price index — New Obour' : 'مؤشر أسعار الأراضي — العبور الجديدة',
    description: locale === 'en' ? 'Indicative land price ranges and trends across New Obour City districts.' : 'نطاقات ومؤشرات أسعار الأراضي التقريبية عبر مناطق مدينة العبور الجديدة.',
    path: '/price-index',
    locale,
  });
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-num text-2xl font-bold text-navy-800">{value}</div>
      <div className="text-xs text-ink-400">{unit}</div>
    </div>
  );
}

/** Change vs the most recent snapshot from a PREVIOUS month (null when no history yet). */
function deltaFor(points: TrendPoint[] | undefined, liveAvg: number, month: string): number | null {
  const prev = points?.filter((p) => p.month < month).at(-1);
  return prev && prev.avgPerM ? (liveAvg - prev.avgPerM) / prev.avgPerM : null;
}

export default async function PriceIndexPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('priceIndex');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);
  const egp = L('ج.م', 'EGP');
  const fmt = (n: number) => n.toLocaleString('en-US');

  const [dists, trendMap] = await Promise.all([computeDistrictPrices(), loadTrends(6)]);
  const month = currentMonth();
  const trends = Object.fromEntries(trendMap);
  const deltas = Object.fromEntries(dists.map((d) => [d.id, deltaFor(trendMap.get(d.id), d.avgPerM, month)]));

  const totalCount = dists.reduce((a, d) => a + d.count, 0);
  const cityAvg = totalCount ? Math.round(dists.reduce((a, d) => a + d.avgPerM * d.count, 0) / totalCount) : 0;
  const cityVolume = dists.reduce((a, d) => a + d.volume, 0);
  const top = dists[0];

  // Heat tint: gold intensity scaled between the cheapest and most expensive district.
  const min = dists.at(-1)?.avgPerM ?? 0, max = top?.avgPerM ?? 0;
  const heat = (avg: number) => `rgba(201, 152, 62, ${(0.06 + 0.3 * ((avg - min) / (max - min || 1))).toFixed(2)})`;

  return (
    <SiteShell active="priceIndex">
      <div className="mx-auto max-w-[1000px] space-y-8 px-6 py-10">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-800">{t('title')}</h1>
          <p className="mt-2 text-ink-500">{t('subtitle')}</p>
        </div>
        {totalCount === 0 ? (
          <p className="text-ink-500">{t('noData')}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label={t('cityAvg')} value={fmt(cityAvg)} unit={`${egp}/${m2}`} />
              <Metric label={t('topDistrict')} value={top ? L(top.nameAr, top.nameEn) : '—'} unit={top ? `${fmt(top.avgPerM)} ${egp}/${m2}` : ''} />
              <Metric label={t('activeVolume')} value={fmt(cityVolume)} unit={egp} />
            </div>

            <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-navy-700">
                  <tr>
                    <th className="p-3 text-start">{t('district')}</th>
                    <th className="p-3 text-start">{t('avgPerM')}</th>
                    <th className="p-3 text-start">{t('monthChange')}</th>
                    <th className="p-3 text-start">{t('trend6m')}</th>
                    <th className="p-3 text-start">{t('count')}</th>
                    <th className="p-3 text-start">{t('volume')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dists.map((d) => {
                    const delta = deltas[d.id];
                    return (
                      <tr key={d.id} className="border-t border-ink-100">
                        <td className="p-3 font-semibold text-navy-800">{L(d.nameAr, d.nameEn)}</td>
                        <td className="p-3" style={{ backgroundColor: heat(d.avgPerM) }}>
                          <span className="font-num font-bold">{fmt(d.avgPerM)}</span>{' '}
                          <span className="text-xs text-ink-500">{egp}/{m2}</span>
                        </td>
                        <td className="p-3">
                          {delta == null ? (
                            <span className="text-ink-300">—</span>
                          ) : (
                            <span className={`font-semibold ${delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {delta >= 0 ? '▲' : '▼'} <span className="font-num">{Math.abs(Math.round(delta * 100))}%</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3"><Spark points={trendMap.get(d.id) ?? []} /></td>
                        <td className="p-3 font-num">{fmt(d.count)}</td>
                        <td className="p-3 font-num">{fmt(d.volume)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-400">{t('trendNote')}</p>

            <PriceCompare dists={dists} trends={trends} deltas={deltas} locale={locale} />

            <p className="text-xs text-ink-400">{t('disclaimer')}</p>
          </>
        )}
      </div>
    </SiteShell>
  );
}
