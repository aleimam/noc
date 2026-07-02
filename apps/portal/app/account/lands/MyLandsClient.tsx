'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { saveUserLand, deleteUserLand, type UserLandInput } from './actions';

type District = { id: string; name: string };
type Neighborhood = { id: string; districtId: string; name: string };
export type LandRow = {
  id: string;
  title: string | null;
  districtId: string | null;
  neighborhoodId: string | null;
  blockNo: string | null;
  plotNo: string | null;
  area: string | null;
  notes: string | null;
  getUpdates: boolean;
  forSale: boolean;
};

const inp = 'w-full rounded-lg border border-graphite/25 bg-transparent px-3 py-2 text-sm';
const empty: UserLandInput = { title: '', districtId: '', neighborhoodId: '', blockNo: '', plotNo: '', area: '', notes: '', getUpdates: false, forSale: false };

export function MyLandsClient({
  lands,
  districts,
  neighborhoods,
}: {
  lands: LandRow[];
  districts: District[];
  neighborhoods: Neighborhood[];
}) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [editing, setEditing] = useState<UserLandInput | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const districtName = (id: string | null) => districts.find((d) => d.id === id)?.name ?? '';
  const nbForDistrict = (id?: string) => neighborhoods.filter((n) => n.districtId === id);

  function openNew() { setError(''); setEditing({ ...empty }); }
  function openEdit(l: LandRow) {
    setError('');
    setEditing({ id: l.id, title: l.title ?? '', districtId: l.districtId ?? '', neighborhoodId: l.neighborhoodId ?? '', blockNo: l.blockNo ?? '', plotNo: l.plotNo ?? '', area: l.area ?? '', notes: l.notes ?? '', getUpdates: l.getUpdates, forSale: l.forSale });
  }

  function submit() {
    if (!editing) return;
    setError('');
    start(async () => {
      const r = await saveUserLand(editing);
      if (r.ok) setEditing(null);
      else setError(t('saveError'));
    });
  }
  function remove(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => { await deleteUserLand(id); });
  }

  if (editing) {
    const e = editing;
    const set = (patch: Partial<UserLandInput>) => setEditing({ ...e, ...patch });
    return (
      <form
        onSubmit={(ev) => { ev.preventDefault(); submit(); }}
        className="space-y-4 rounded-xl border border-graphite/15 p-5"
      >
        <h2 className="text-lg font-bold text-primary">{e.id ? t('editLand') : t('addLand')}</h2>
        <label className="block text-sm">{t('landTitle')}<input value={e.title} onChange={(ev) => set({ title: ev.target.value })} className={inp} placeholder={t('landTitleHint')} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">{t('district')}
            <select value={e.districtId} onChange={(ev) => set({ districtId: ev.target.value, neighborhoodId: '' })} className={inp}>
              <option value="">—</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">{t('neighborhood')}
            <select value={e.neighborhoodId} onChange={(ev) => set({ neighborhoodId: ev.target.value })} className={inp} disabled={!e.districtId}>
              <option value="">—</option>
              {nbForDistrict(e.districtId).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">{t('block')}<input value={e.blockNo} onChange={(ev) => set({ blockNo: ev.target.value })} className={inp} /></label>
          <label className="block text-sm">{t('plot')}<input value={e.plotNo} onChange={(ev) => set({ plotNo: ev.target.value })} className={inp} /></label>
          <label className="block text-sm">{t('area')}<input value={e.area} onChange={(ev) => set({ area: ev.target.value })} inputMode="decimal" className={inp} /></label>
        </div>
        <label className="block text-sm">{t('notes')}<textarea value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} rows={2} className={inp} /></label>

        <label className="flex items-start gap-3 rounded-lg bg-green/5 p-3 text-sm">
          <input type="checkbox" checked={e.getUpdates} onChange={(ev) => set({ getUpdates: ev.target.checked })} className="mt-1 h-5 w-5" />
          <span><strong className="block text-primary">{t('getUpdates')}</strong><span className="opacity-75">{t('getUpdatesHint')}</span></span>
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-gold/10 p-3 text-sm">
          <input type="checkbox" checked={e.forSale} onChange={(ev) => set({ forSale: ev.target.checked })} className="mt-1 h-5 w-5" />
          <span><strong className="block text-primary">{t('forSale')}</strong><span className="opacity-75">{t('forSaleHint')}</span></span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button disabled={pending} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-soft disabled:opacity-50">{pending ? t('saving') : t('save')}</button>
          <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-graphite/25 px-5 py-2 text-sm">{t('cancel')}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={openNew} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-soft">+ {t('addLand')}</button>
      {lands.length === 0 ? (
        <p className="rounded-lg border border-dashed border-graphite/25 p-6 text-center text-sm opacity-70">{t('noLands')}</p>
      ) : (
        <ul className="space-y-3">
          {lands.map((l) => (
            <li key={l.id} className="rounded-xl border border-graphite/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-primary">{l.title || t('untitledLand')}</p>
                  <p className="text-sm opacity-75">
                    {[districtName(l.districtId), l.blockNo && `${t('block')} ${l.blockNo}`, l.plotNo && `${t('plot')} ${l.plotNo}`, l.area && `${l.area} ${locale === 'en' ? 'm²' : 'م²'}`].filter(Boolean).join(' • ') || '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {l.getUpdates && <span className="rounded-full bg-green/15 px-2.5 py-1 text-green">{t('getUpdatesBadge')}</span>}
                    {l.forSale && <span className="rounded-full bg-gold/20 px-2.5 py-1 text-primary">{t('forSaleBadge')}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => openEdit(l)} className="rounded-md border border-graphite/25 px-3 py-1.5 text-xs">{t('edit')}</button>
                  <button onClick={() => remove(l.id)} disabled={pending} className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50">{t('delete')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
