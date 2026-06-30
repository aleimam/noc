'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertCity, deleteCity } from './actions';

type City = { id: string; name: string; nameEn: string | null; order: number; isActive: boolean; count: number };
type Draft = { id?: string; name: string; nameEn: string; order: number; isActive: boolean };

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function CitiesManager({ cities }: { cities: City[] }) {
  const t = useTranslations('rationing');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertCity(draft);
      if (r.ok) {
        setDraft(null);
        router.refresh();
      } else setError(r.error === 'duplicate' ? t('cityDuplicate') : r.error === 'name_required' ? t('cityNameRequired') : t('err_failed'));
    });
  }
  function del(c: City) {
    if (!confirm(c.count > 0 ? t('confirmDeleteCityWithRows', { n: c.count }) : t('confirmDeleteCity'))) return;
    setError('');
    start(async () => {
      const r = await deleteCity(c.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="opacity-60">
            <tr>
              <th className="p-2 text-start">{t('cityName')}</th>
              <th className="p-2 text-start">{t('cityNameEn')}</th>
              <th className="p-2 text-start">{t('order')}</th>
              <th className="p-2 text-start">{t('rows')}</th>
              <th className="p-2 text-start">{t('active')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {cities.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center opacity-60">{t('noCities')}</td></tr>
            )}
            {cities.map((c) => (
              <tr key={c.id} className="border-t border-graphite/10">
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2" dir="ltr">{c.nameEn || '—'}</td>
                <td className="p-2">{c.order}</td>
                <td className="p-2 opacity-70">{c.count}</td>
                <td className="p-2">{c.isActive ? '✔' : '—'}</td>
                <td className="whitespace-nowrap p-2 text-end">
                  <button onClick={() => setDraft({ id: c.id, name: c.name, nameEn: c.nameEn ?? '', order: c.order, isActive: c.isActive })} className="px-2 py-1 text-accent">{t('edit')}</button>
                  <button disabled={pending} onClick={() => del(c)} className="px-2 py-1 text-red-600">{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-graphite/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('cityName')}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('cityNameEn')}<input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} dir="ltr" className={inp} /></label>
            <label className="text-sm">{t('order')}<input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: parseInt(e.target.value, 10) || 0 })} className={inp} /></label>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pending || !draft.name.trim()} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ name: '', nameEn: '', order: 0, isActive: true })} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">+ {t('addCity')}</button>
      )}
    </div>
  );
}
