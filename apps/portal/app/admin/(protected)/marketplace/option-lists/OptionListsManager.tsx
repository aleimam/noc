'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';
import { upsertOptionList, deleteOptionList } from '../actions';

type Item = { id?: string; key: string; labelAr: string; labelEn: string; isActive: boolean };
type List = { id: string; name: string; usedBy: number; items: Item[] };
type Draft = { id?: string; name: string; items: Item[] };

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const cell = 'flex-1 rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';
const EMPTY: Draft = { name: '', items: [] };

export function OptionListsManager({ lists }: { lists: List[] }) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const setItem = (i: number, patch: Partial<Item>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : d));

  function save() {
    if (!draft || !draft.name.trim()) { setError('failed'); return; }
    setError('');
    start(async () => {
      const r = await upsertOptionList(draft);
      if (r.ok) { setDraft(null); router.refresh(); toast(t('savedOk')); }
      else setError(r.error);
    });
  }
  function del(id: string) {
    setError('');
    start(async () => {
      const r = await deleteOptionList(id);
      if (r.ok) { router.refresh(); toast(t('deleted')); }
      else setError(r.error === 'in_use' ? t('inUse') : t('none'));
    });
  }

  if (draft) {
    const d = draft;
    return (
      <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
        {error && <p className="text-sm text-red-600">{error === 'failed' ? t('none') : error}</p>}
        <label className="block text-sm">{t('listName')}<input value={d.name} onChange={(e) => setDraft({ ...d, name: e.target.value })} className={inp} /></label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('options')}</h3>
            <button onClick={() => setDraft({ ...d, items: [...d.items, { key: '', labelAr: '', labelEn: '', isActive: true }] })} className="rounded border border-graphite/25 px-2 py-1 text-xs">+ {t('add')}</button>
          </div>
          {d.items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input dir="ltr" placeholder={t('key')} value={it.key} onChange={(e) => setItem(i, { key: e.target.value })} className="w-28 rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm" />
              <input placeholder={t('labelAr')} value={it.labelAr} onChange={(e) => setItem(i, { labelAr: e.target.value })} className={cell} />
              <input dir="ltr" placeholder={t('labelEn')} value={it.labelEn} onChange={(e) => setItem(i, { labelEn: e.target.value })} className={cell} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.isActive} onChange={(e) => setItem(i, { isActive: e.target.checked })} />{t('active')}</label>
              <button onClick={() => setDraft({ ...d, items: d.items.filter((_, j) => j !== i) })} className="px-1 text-red-600">✕</button>
            </div>
          ))}
          {d.items.length === 0 && <p className="text-xs opacity-50">{t('none')}</p>}
        </div>
        <div className="flex gap-2">
          <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
          <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={() => setDraft({ ...EMPTY, items: [] })} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('newList')}</button>
      <div className="space-y-2">
        {lists.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-graphite/15 p-3">
            <div>
              <span className="font-semibold">{l.name}</span>
              <span className="ms-2 text-xs opacity-60">{l.items.length} {t('optionCount')} · {l.usedBy} {t('usedByAttrs')}</span>
              <div className="mt-1 text-xs opacity-70">{l.items.slice(0, 8).map((i) => i.labelAr).join('، ')}{l.items.length > 8 ? '…' : ''}</div>
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              <button onClick={() => setDraft({ id: l.id, name: l.name, items: l.items.map((i) => ({ ...i })) })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(l.id)} className="text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
        {lists.length === 0 && <p className="text-sm opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
