'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';

export type CatalogRow = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  order: number;
  isActive: boolean;
  meta?: string;
};
type UpsertInput = { id?: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean };
type Result = { ok: true } | { ok: false; error: string };
type SortKey = 'order' | 'nameAr' | 'nameEn' | 'key' | 'isActive';

const input = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1';

export function CatalogTable({
  initial,
  upsert,
  remove,
  detailBase,
  childAdd,
  defaultSort = 'order',
}: {
  initial: CatalogRow[];
  upsert: (i: UpsertInput) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  detailBase?: string; // when set, the Arabic name links to `${detailBase}/${id}`
  childAdd?: { hrefBase: string; label: string }; // per-row quick "add child" link (→ `${hrefBase}?district=${id}`)
  defaultSort?: SortKey; // initial sort column (name-centric lists pass 'nameAr')
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<UpsertInput | null>(null); // edit OR add (add has no id)
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  function run(fn: () => Promise<Result>, done?: () => void) {
    setError('');
    start(async () => {
      const r = await fn();
      if (r.ok) {
        done?.();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir('asc');
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? initial.filter((r) => `${r.nameAr} ${r.nameEn} ${r.key} ${r.meta ?? ''}`.toLowerCase().includes(needle))
      : initial.slice();
    filtered.sort((a, b) => {
      let r = 0;
      if (sortKey === 'order') r = a.order - b.order;
      else if (sortKey === 'isActive') r = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
      else r = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'ar');
      return dir === 'asc' ? r : -r;
    });
    return filtered;
  }, [initial, q, sortKey, dir]);

  const editing = (row: CatalogRow) => draft?.id === row.id;
  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="p-2 text-start">
      <button type="button" onClick={() => toggleSort(k)} className="font-semibold hover:text-accent">{label}{arrow(k)}</button>
    </th>
  );

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{t('delete')}: {error}</p>}
      <div className="flex items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="w-full max-w-xs rounded-md border border-graphite/20 bg-transparent px-3 py-1.5 text-sm" />
        <span className="whitespace-nowrap text-xs opacity-60">{rows.length}/{initial.length}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-graphite/15">
        <table className="w-full text-sm">
          <thead className="bg-graphite/5 text-start">
            <tr>
              <Th k="order" label={t('order')} />
              <Th k="nameAr" label={t('nameAr')} />
              <Th k="nameEn" label={t('nameEn')} />
              <Th k="key" label={t('key')} />
              <Th k="isActive" label={t('active')} />
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center opacity-60">{t('none')}</td></tr>
            )}
            {rows.map((row) =>
              editing(row) && draft ? (
                <tr key={row.id} className="border-t border-graphite/10">
                  <td className="p-1">
                    <input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: +e.target.value })} className="w-16 rounded border border-graphite/20 bg-transparent px-2 py-1" />
                  </td>
                  <td className="p-1"><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className={input} /></td>
                  <td className="p-1"><input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className={input} /></td>
                  <td className="p-1 font-mono text-xs opacity-60">{row.key}</td>
                  <td className="p-1"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /></td>
                  <td className="whitespace-nowrap p-1 text-end">
                    <button disabled={pending} onClick={() => run(() => upsert(draft), () => { setDraft(null); toast(t('savedOk')); })} className="rounded bg-primary px-2 py-1 text-soft">{t('save')}</button>
                    <button onClick={() => setDraft(null)} className="px-2 py-1 opacity-70">{t('cancel')}</button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="border-t border-graphite/10">
                  <td className="p-2">{row.order}</td>
                  <td className="p-2">
                    {detailBase ? (
                      <a href={`${detailBase}/${row.id}`} className="text-accent hover:underline">{row.nameAr}</a>
                    ) : (
                      row.nameAr
                    )}
                  </td>
                  <td className="p-2" dir="ltr">{row.nameEn}</td>
                  <td className="p-2 font-mono text-xs opacity-60">
                    {row.key}
                    {row.meta ? <span className="opacity-70"> · {row.meta}</span> : null}
                  </td>
                  <td className="p-2">{row.isActive ? '✔' : '—'}</td>
                  <td className="whitespace-nowrap p-2 text-end">
                    {childAdd && <a href={`${childAdd.hrefBase}?district=${row.id}`} className="px-2 py-1 text-green">{childAdd.label}</a>}
                    <button onClick={() => setDraft({ id: row.id, key: row.key, nameAr: row.nameAr, nameEn: row.nameEn, order: row.order, isActive: row.isActive })} className="px-2 py-1 text-accent">{t('edit')}</button>
                    <button disabled={pending} onClick={() => run(() => remove(row.id), () => toast(t('deleted')))} className="px-2 py-1 text-red-600">{t('delete')}</button>
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
          <button disabled={pending || !draft.key.trim()} onClick={() => run(() => upsert(draft), () => { setDraft(null); toast(t('savedOk')); })} className="rounded bg-primary px-3 py-2 text-soft disabled:opacity-50">{t('save')}</button>
          <button onClick={() => setDraft(null)} className="px-3 py-2 opacity-70">{t('cancel')}</button>
        </div>
      ) : (
        <button onClick={() => setDraft({ key: '', nameAr: '', nameEn: '', order: initial.length, isActive: true })} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10">
          + {t('add')}
        </button>
      )}
    </div>
  );
}
