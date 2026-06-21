'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertPropertyType, deletePropertyType } from '../actions';

type Row = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  order: number;
  isActive: boolean;
  groupId: string | null;
  groupLabel: string;
};
type Draft = { id?: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean; groupId: string };
type GroupOpt = { id: string; label: string; category: string };
type Result = { ok: boolean; error?: string };

const input = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1';

export function TypesManager({ initial, groups }: { initial: Row[]; groups: GroupOpt[] }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const cats = [...new Set(groups.map((g) => g.category))];

  function run(fn: () => Promise<Result>, done?: () => void) {
    setError('');
    start(async () => {
      const r = await fn();
      if (r.ok) {
        done?.();
        router.refresh();
      } else setError(r.error ?? 'failed');
    });
  }

  function GroupSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        <option value="">— {t('noGroup')} —</option>
        {cats.map((c) => (
          <optgroup key={c} label={c}>
            {groups.filter((g) => g.category === c).map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  const save = (d: Draft, done: () => void) =>
    run(() => upsertPropertyType({ ...d, groupId: d.groupId || null }), done);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="bg-graphite/5">
            <tr>
              <th className="p-2 text-start">{t('order')}</th>
              <th className="p-2 text-start">{t('nameAr')}</th>
              <th className="p-2 text-start">{t('nameEn')}</th>
              <th className="p-2 text-start">{t('group')}</th>
              <th className="p-2 text-start">{t('key')}</th>
              <th className="p-2 text-start">{t('active')}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((row) =>
              draft?.id === row.id && draft ? (
                <tr key={row.id} className="border-t border-graphite/10">
                  <td className="p-1"><input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: +e.target.value })} className="w-16 rounded border border-graphite/20 bg-transparent px-2 py-1" /></td>
                  <td className="p-1"><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className={input} /></td>
                  <td className="p-1"><input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className={input} /></td>
                  <td className="p-1"><GroupSelect value={draft.groupId} onChange={(v) => setDraft({ ...draft, groupId: v })} /></td>
                  <td className="p-1 font-mono text-xs opacity-60">{row.key}</td>
                  <td className="p-1"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /></td>
                  <td className="whitespace-nowrap p-1 text-end">
                    <button disabled={pending} onClick={() => save(draft, () => setDraft(null))} className="rounded bg-primary px-2 py-1 text-soft">{t('save')}</button>
                    <button onClick={() => setDraft(null)} className="px-2 py-1 opacity-70">{t('cancel')}</button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="border-t border-graphite/10">
                  <td className="p-2">{row.order}</td>
                  <td className="p-2">{row.nameAr}</td>
                  <td className="p-2" dir="ltr">{row.nameEn}</td>
                  <td className="p-2">{row.groupLabel || <span className="opacity-40">—</span>}</td>
                  <td className="p-2 font-mono text-xs opacity-60">{row.key}</td>
                  <td className="p-2">{row.isActive ? '✔' : '—'}</td>
                  <td className="whitespace-nowrap p-2 text-end">
                    <button onClick={() => setDraft({ id: row.id, key: row.key, nameAr: row.nameAr, nameEn: row.nameEn, order: row.order, isActive: row.isActive, groupId: row.groupId ?? '' })} className="px-2 py-1 text-accent">{t('edit')}</button>
                    <button disabled={pending} onClick={() => run(() => deletePropertyType(row.id))} className="px-2 py-1 text-red-600">{t('delete')}</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {draft && !draft.id ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-graphite/15 p-3">
          <label className="text-sm">{t('key')}<input dir="ltr" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className={input} /></label>
          <label className="text-sm">{t('nameAr')}<input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className={input} /></label>
          <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className={input} /></label>
          <label className="text-sm">{t('group')}<GroupSelect value={draft.groupId} onChange={(v) => setDraft({ ...draft, groupId: v })} /></label>
          <button disabled={pending || !draft.key.trim()} onClick={() => save(draft, () => setDraft(null))} className="rounded bg-primary px-3 py-2 text-soft disabled:opacity-50">{t('save')}</button>
          <button onClick={() => setDraft(null)} className="px-3 py-2 opacity-70">{t('cancel')}</button>
        </div>
      ) : (
        <button onClick={() => setDraft({ key: '', nameAr: '', nameEn: '', order: initial.length, isActive: true, groupId: '' })} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">+ {t('add')}</button>
      )}
    </div>
  );
}
