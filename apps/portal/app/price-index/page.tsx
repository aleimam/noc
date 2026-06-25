import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PublicShell } from '@noc/ui';
import { localizeUnit } from '@noc/i18n';

export const dynamic = 'force-dynamic';

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-num text-2xl font-bold text-navy-800">{value}</div>
      <div className="text-xs text-ink-400">{unit}</div>
    </div>
  );
}

export default async function PriceIndexPage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('priceIndex');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);
  const egp = L('ج.م', 'EGP');
  const fmt = (n: number) => n.toLocaleString('en-US');

  // Computed from published land plots that have both an area and a price.
  const lands = await prisma.land.findMany({
    where: { status: 'PUBLISHED', area: { not: null }, price: { not: null } },
    select: { area: true, price: true, neighborhood: { select: { district: { select: { id: true, nameAr: true, nameEn: true } } } } },
  });

  type Agg = { id: string; nameAr: string; nameEn: string; count: number; sumPerM: number; volume: number };
  const byDist = new Map<string, Agg>();
  let cityPerMSum = 0, cityCount = 0, cityVolume = 0;
  for (const l of lands) {
    const d = l.neighborhood?.district;
    const area = l.area ? Number(l.area) : 0;
    const price = l.price ? Number(l.price) : 0;
    if (!d || !area || !price) continue;
    const perM = price / area;
    const a = byDist.get(d.id) ?? { id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, count: 0, sumPerM: 0, volume: 0 };
    a.count++; a.sumPerM += perM; a.volume += price;
    byDist.set(d.id, a);
    cityPerMSum += perM; cityCount++; cityVolume += price;
  }
  const dists = [...byDist.values()].map((a) => ({ ...a, avgPerM: Math.round(a.sumPerM / a.count) })).sort((x, y) => y.avgPerM - x.avgPerM);
  const cityAvg = cityCount ? Math.round(cityPerMSum / cityCount) : 0;
  const top = dists[0];

  return (
    <PublicShell active="priceIndex">
      <div className="mx-auto max-w-[1000px] space-y-8 px-6 py-10">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-800">{t('title')}</h1>
          <p className="mt-2 text-ink-500">{t('subtitle')}</p>
        </div>
        {cityCount === 0 ? (
          <p className="text-ink-500">{t('noData')}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label={t('cityAvg')} value={fmt(cityAvg)} unit={`${egp}/${m2}`} />
              <Metric label={t('topDistrict')} value={top ? L(top.nameAr, top.nameEn) : '—'} unit={top ? `${fmt(top.avgPerM)} ${egp}/${m2}` : ''} />
              <Metric label={t('activeVolume')} value={fmt(Math.round(cityVolume))} unit={egp} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-navy-700">
                  <tr>
                    <th className="p-3 text-start">{t('district')}</th>
                    <th className="p-3 text-start">{t('avgPerM')}</th>
                    <th className="p-3 text-start">{t('count')}</th>
                    <th className="p-3 text-start">{t('volume')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dists.map((d) => (
                    <tr key={d.id} className="border-t border-ink-100">
                      <td className="p-3 font-semibold text-navy-800">{L(d.nameAr, d.nameEn)}</td>
                      <td className="p-3"><span className="font-num font-bold">{fmt(d.avgPerM)}</span> <span className="text-xs text-ink-500">{egp}/{m2}</span></td>
                      <td className="p-3 font-num">{fmt(d.count)}</td>
                      <td className="p-3 font-num">{fmt(Math.round(d.volume))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-400">{t('disclaimer')}</p>
          </>
        )}
      </div>
    </PublicShell>
  );
}
