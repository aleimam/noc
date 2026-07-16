'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { deleteNeighborhood } from './actions';

type N = {
  id: string;
  districtId: string;
  nameAr: string;
  nameEn: string;
  assortedAreas: boolean;
  areas: number[];
  derivedAreas: number[]; // plot-derived sizes NOT already in the manual list (auto, from listed plots)
  order: number;
  isActive: boolean;
  hasMasterplan: boolean;
  hasLocationMap: boolean;
};
type D = { id: string; nameAr: string; nameEn: string };

export function NeighborhoodsManager({ neighborhoods, districts, locale }: { neighborhoods: N[]; districts: D[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const dName = (id: string) => {
    const d = districts.find((x) => x.id === id);
    return d ? L(d.nameAr, d.nameEn) : '—';
  };

  const [q, setQ] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  // Default sort = ترتيب (order): neighborhoods are numbered (مجاورة 1، 2، 3…) and lists
  // must follow that number, not the alphabetic name (where 10 sorts before 2).
  const [sortKey, setSortKey] = useState<'order' | 'district' | 'neighborhood' | 'maps'>('order');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  function toggleSort(k: 'order' | 'district' | 'neighborhood' | 'maps') {
    if (sortKey === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setDir('asc'); }
  }
  const arrow = (k: 'order' | 'district' | 'neighborhood' | 'maps') => (sortKey === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = neighborhoods.filter(
      (n) => (!districtFilter || n.districtId === districtFilter) && (!needle || `${n.nameAr} ${n.nameEn} ${dName(n.districtId)}`.toLowerCase().includes(needle)),
    );
    rows.sort((a, b) => {
      let r = 0;
      if (sortKey === 'order') r = a.order - b.order || L(a.nameAr, a.nameEn).localeCompare(L(b.nameAr, b.nameEn), 'ar');
      else if (sortKey === 'district') r = dName(a.districtId).localeCompare(dName(b.districtId), 'ar');
      else if (sortKey === 'maps') r = (Number(a.hasMasterplan) + Number(a.hasLocationMap)) - (Number(b.hasMasterplan) + Number(b.hasLocationMap));
      else r = L(a.nameAr, a.nameEn).localeCompare(L(b.nameAr, b.nameEn), 'ar');
      return dir === 'asc' ? r : -r;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhoods, q, districtFilter, sortKey, dir]);

  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setError('');
    start(async () => {
      const r = await deleteNeighborhood(id);
      if (!r.ok) setError(r.error);
      else toast(t('deleted'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error === 'in_use' ? t('inUse') : error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="w-full max-w-xs rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm">
          <option value="">{t('allDistricts')}</option>
          {districts.map((d) => (<option key={d.id} value={d.id}>{L(d.nameAr, d.nameEn)}</option>))}
        </select>
        <span className="text-xs opacity-60">{view.length}/{neighborhoods.length}</span>
        <a href="/admin/lands/neighborhoods/new" className={`ms-auto rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10 ${districts.length === 0 ? 'pointer-events-none opacity-50' : ''}`}>+ {t('addNeighborhood')}</a>
      </div>
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="bg-graphite/5">
            <tr>
              <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('district')} className="font-semibold hover:text-accent">{t('district')}{arrow('district')}</button></th>
              <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('neighborhood')} className="font-semibold hover:text-accent">{t('neighborhood')}{arrow('neighborhood')}</button></th>
              <th className="p-2 text-start">{t('areas')}</th>
              <th className="p-2 text-start"><button type="button" onClick={() => toggleSort('maps')} className="font-semibold hover:text-accent">{L('الخرائط', 'Maps')}{arrow('maps')}</button></th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center opacity-60">{t('noNeighborhoods')}</td>
              </tr>
            )}
            {view.map((n) => (
              <tr key={n.id} className="border-t border-graphite/10">
                <td className="p-2">{dName(n.districtId)}</td>
                <td className="p-2 font-medium">
                  <a href={`/admin/lands/neighborhoods/${n.id}/edit`} className="text-accent hover:underline">{L(n.nameAr, n.nameEn)}</a>
                  {!n.isActive && <span className="opacity-50"> · {t('active')}: —</span>}
                </td>
                <td className="p-2 text-xs opacity-70">
                  {n.assortedAreas ? t('assorted') : (n.areas.length || n.derivedAreas.length) ? (
                    <>
                      {n.areas.join('، ')}
                      {n.derivedAreas.length > 0 && (
                        <span className="text-accent" title={L('مضافة تلقائياً من القطع المعروضة', 'auto-added from listed plots')}>
                          {n.areas.length ? '، ' : ''}🏷️ {n.derivedAreas.join('، ')}
                        </span>
                      )}
                    </>
                  ) : '—'}
                </td>
                {/* Map coverage at a glance: masterplan + location map, green when present. */}
                <td className="whitespace-nowrap p-2">
                  <span className={`me-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${n.hasMasterplan ? 'bg-green/15 text-green' : 'bg-graphite/10 text-graphite/50'}`} title={t('masterplan')}>
                    🗺️ {L('مخطط', 'Plan')} {n.hasMasterplan ? '✓' : '—'}
                  </span>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${n.hasLocationMap ? 'bg-green/15 text-green' : 'bg-graphite/10 text-graphite/50'}`} title={t('locationMap')}>
                    📍 {L('موقع', 'Location')} {n.hasLocationMap ? '✓' : '—'}
                  </span>
                </td>
                <td className="whitespace-nowrap p-2 text-end">
                  <a href={`/admin/lands/neighborhoods/${n.id}/edit`} className="px-2 py-1 text-accent">{t('edit')}</a>
                  <button disabled={pending} onClick={() => del(n.id)} className="px-2 py-1 text-red-600">{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
