'use client';

import { useState } from 'react';
import type { DistrictPrice, TrendPoint } from '../../lib/priceIndex';
import { Spark } from './Spark';

// Side-by-side two-district comparator. Big, explicit, mobile-first (golden rule):
// two large selects, two cards, and a plain-language "X is cheaper than Y by Z%" line.
export function PriceCompare({ dists, trends, deltas, locale }: {
  dists: DistrictPrice[];
  trends: Record<string, TrendPoint[]>;
  deltas: Record<string, number | null>;
  locale: 'ar' | 'en';
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [aId, setAId] = useState(dists[0]?.id ?? '');
  const [bId, setBId] = useState(dists[1]?.id ?? dists[0]?.id ?? '');
  if (dists.length < 2) return null;

  const fmt = (n: number) => n.toLocaleString('en-US');
  const name = (d: DistrictPrice) => (locale === 'ar' ? d.nameAr : d.nameEn);
  const a = dists.find((d) => d.id === aId) ?? dists[0]!;
  const b = dists.find((d) => d.id === bId) ?? dists[1]!;

  const cheap = a.avgPerM <= b.avgPerM ? a : b;
  const exp = cheap === a ? b : a;
  const pct = exp.avgPerM ? Math.round(((exp.avgPerM - cheap.avgPerM) / exp.avgPerM) * 100) : 0;

  const select = (val: string, set: (v: string) => void, label: string) => (
    <label className="flex-1 space-y-1">
      <span className="block text-sm font-semibold text-navy-700">{label}</span>
      <select
        value={val}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-lg border border-ink-200 bg-white p-3 text-base font-semibold text-navy-800"
      >
        {dists.map((d) => <option key={d.id} value={d.id}>{name(d)}</option>)}
      </select>
    </label>
  );

  const card = (d: DistrictPrice) => {
    const delta = deltas[d.id];
    return (
      <div className={`space-y-2 rounded-xl border p-4 ${d === cheap && a.id !== b.id ? 'border-green-600/40 bg-green-50/50' : 'border-ink-200 bg-white'}`}>
        <div className="text-base font-bold text-navy-800">{name(d)}</div>
        <div>
          <span className="font-num text-2xl font-extrabold text-navy-800">{fmt(d.avgPerM)}</span>
          <span className="ms-1 text-xs text-ink-500">{L('ج.م/م²', 'EGP/m²')}</span>
        </div>
        {delta != null && (
          <div className={`text-sm font-semibold ${delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {delta >= 0 ? '▲' : '▼'} <span className="font-num">{Math.abs(Math.round(delta * 100))}%</span>{' '}
            <span className="text-xs font-normal text-ink-500">{L('عن الشهر الماضي', 'vs last month')}</span>
          </div>
        )}
        <Spark points={trends[d.id] ?? []} />
        <div className="text-xs text-ink-500">
          {L(`${fmt(d.count)} قطعة معروضة · الحجم ${fmt(d.volume)} ج.م`, `${fmt(d.count)} plots · volume ${fmt(d.volume)} EGP`)}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-ink-200 bg-navy-50/40 p-5">
      <h2 className="text-xl font-extrabold text-navy-800">{L('قارن بين حيين', 'Compare two districts')}</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        {select(aId || a.id, setAId, L('الحي الأول', 'First district'))}
        {select(bId || b.id, setBId, L('الحي الثاني', 'Second district'))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {card(a)}
        {card(b)}
      </div>
      {a.id !== b.id && (
        <p className="rounded-lg bg-white p-3 text-center text-base font-bold text-navy-800">
          {pct === 0
            ? L('متوسط السعر متساوٍ تقريبًا في الحيّين.', 'Average prices are about equal.')
            : L(`«${name(cheap)}» أرخص من «${name(exp)}» بنحو ${pct}٪`, `“${name(cheap)}” is about ${pct}% cheaper than “${name(exp)}”`)}
        </p>
      )}
    </section>
  );
}
