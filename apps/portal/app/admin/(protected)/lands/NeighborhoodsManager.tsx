'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AREA_PRESETS, BUILDING_TYPES, MAIN_ROADS } from '@noc/config';
import { toast } from '@noc/ui';
import { upsertNeighborhood, deleteNeighborhood } from './actions';

type N = {
  id: string;
  districtId: string;
  nameAr: string;
  nameEn: string;
  hasBlocks: boolean;
  assortedAreas: boolean;
  areas: number[];
  buildingTypes: string[];
  mainRoads: string[];
  order: number;
  isActive: boolean;
  hasMasterplan: boolean;
  hasLocationMap: boolean;
};
type D = { id: string; nameAr: string; nameEn: string };
type Draft = Omit<N, 'hasMasterplan' | 'hasLocationMap' | 'id'> & { id?: string };

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function NeighborhoodsManager({ neighborhoods, districts, locale }: { neighborhoods: N[]; districts: D[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const dName = (id: string) => {
    const d = districts.find((x) => x.id === id);
    return d ? L(d.nameAr, d.nameEn) : '—';
  };

  const blank: Draft = { districtId: districts[0]?.id ?? '', nameAr: '', nameEn: '', hasBlocks: false, assortedAreas: false, areas: [], buildingTypes: [], mainRoads: [], order: 0, isActive: true };

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

  function save() {
    if (!draft) return;
    setError('');
    // New neighborhood with the order left at 0: derive it from the number in the
    // name (مجاورة 12 → 12) so lists sort naturally without manual bookkeeping.
    const num = /([0-9]+)/.exec(`${draft.nameAr} ${draft.nameEn}`)?.[1];
    const toSave = !draft.id && !draft.order && num ? { ...draft, order: Number(num) } : draft;
    start(async () => {
      const r = await upsertNeighborhood(toSave);
      if (r.ok) {
        setDraft(null);
        router.refresh();
      } else setError(r.error);
    });
  }
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

  const chip = (active: boolean) => `cursor-pointer rounded border px-2 py-1 ${active ? 'border-accent bg-accent/10' : 'border-graphite/20'}`;

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
                  <a href={`/admin/lands/neighborhoods/${n.id}`} className="text-accent hover:underline">{L(n.nameAr, n.nameEn)}</a>
                  {!n.isActive && <span className="opacity-50"> · {t('active')}: —</span>}
                </td>
                <td className="p-2 text-xs opacity-70">{n.assortedAreas ? t('assorted') : n.areas.join(', ') || '—'}</td>
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
                  <button onClick={() => setDraft({ id: n.id, districtId: n.districtId, nameAr: n.nameAr, nameEn: n.nameEn, hasBlocks: n.hasBlocks, assortedAreas: n.assortedAreas, areas: n.areas, buildingTypes: n.buildingTypes, mainRoads: n.mainRoads, order: n.order, isActive: n.isActive })} className="px-2 py-1 text-accent">{t('edit')}</button>
                  <button disabled={pending} onClick={() => del(n.id)} className="px-2 py-1 text-red-600">{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {t('district')}
              <select value={draft.districtId} onChange={(e) => setDraft({ ...draft, districtId: e.target.value })} className={inp}>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{L(d.nameAr, d.nameEn)}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">{t('order')}<input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: +e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('nameAr')}<input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className={inp} /></label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.hasBlocks} onChange={(e) => setDraft({ ...draft, hasBlocks: e.target.checked })} /> {t('hasBlocks')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.assortedAreas} onChange={(e) => setDraft({ ...draft, assortedAreas: e.target.checked })} /> {t('assorted')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          </div>

          {!draft.assortedAreas && (
            <div className="text-sm">
              <div className="mb-1 opacity-70">{t('areas')}</div>
              <div className="flex flex-wrap gap-2">
                {AREA_PRESETS.map((a) => (
                  <label key={a} className={chip(draft.areas.includes(a))}>
                    <input type="checkbox" className="hidden" checked={draft.areas.includes(a)} onChange={() => setDraft({ ...draft, areas: toggle(draft.areas, a) })} /> {a}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm">
            <div className="mb-1 opacity-70">{t('buildingTypes')}</div>
            <div className="flex flex-wrap gap-2">
              {BUILDING_TYPES.map((b) => (
                <label key={b.key} className={chip(draft.buildingTypes.includes(b.key))}>
                  <input type="checkbox" className="hidden" checked={draft.buildingTypes.includes(b.key)} onChange={() => setDraft({ ...draft, buildingTypes: toggle(draft.buildingTypes, b.key) })} /> {L(b.ar, b.en)}
                </label>
              ))}
            </div>
          </div>

          <div className="text-sm">
            <div className="mb-1 opacity-70">{t('mainRoads')}</div>
            <div className="flex flex-wrap gap-2">
              {MAIN_ROADS.map((r) => (
                <label key={r.key} className={chip(draft.mainRoads.includes(r.key))}>
                  <input type="checkbox" className="hidden" checked={draft.mainRoads.includes(r.key)} onChange={() => setDraft({ ...draft, mainRoads: toggle(draft.mainRoads, r.key) })} /> {L(r.ar, r.en)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button disabled={pending || !draft.districtId || !draft.nameAr.trim()} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft(blank)} disabled={districts.length === 0} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10 disabled:opacity-50">+ {t('add')}</button>
      )}
    </div>
  );
}
