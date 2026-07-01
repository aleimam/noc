'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';

type Result = { ok: true } | { ok: false; error: string };
type ParentOpt = { id: string; nameAr: string; nameEn: string };
type Opt = { id: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean; parentOptionId: string | null; allowedOnAlsawarey: boolean };
type Draft = { id?: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean; parentOptionId: string; allowedOnAlsawarey: boolean };

const EMPTY: Draft = { key: '', nameAr: '', nameEn: '', order: 0, isActive: true, parentOptionId: '', allowedOnAlsawarey: true };
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function ClassifierOptionsEditor({
  initial,
  parentOptions,
  parentLabel,
  showAlsawarey,
  upsert,
  remove,
}: {
  initial: Opt[];
  parentOptions: ParentOpt[];
  parentLabel: string;
  showAlsawarey: boolean;
  upsert: (input: Draft) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const hasParent = parentOptions.length > 0 || initial.some((o) => o.parentOptionId);
  const pName = (id: string | null) => {
    const p = parentOptions.find((x) => x.id === id);
    return p ? p.nameAr : '—';
  };

  function save() {
    if (!draft || !draft.nameAr.trim() || (!draft.id && !draft.key.trim())) { setError('failed'); return; }
    setError('');
    start(async () => {
      const r = await upsert(draft);
      if (r.ok) { setDraft(null); router.refresh(); toast(t('savedOk')); }
      else setError(r.error);
    });
  }
  function del(id: string) {
    start(async () => {
      const r = await remove(id);
      if (r.ok) { router.refresh(); toast(t('deleted')); }
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error === 'in_use' ? t('inUse') : error === 'duplicate_key' ? t('ownerCodeTaken') : t('none')}</p>}

      {draft ? (
        <div className="grid gap-3 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
          <label className="text-sm">{t('nameAr')}<input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className={inp} /></label>
          {!draft.id && <label className="text-sm">key<input dir="ltr" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className={inp} placeholder="slug" /></label>}
          <label className="text-sm">{t('order')}<input type="number" dir="ltr" value={draft.order} onChange={(e) => setDraft({ ...draft, order: parseInt(e.target.value, 10) || 0 })} className={inp} /></label>
          {parentOptions.length > 0 && (
            <label className="text-sm">{parentLabel} (الأصل)
              <select value={draft.parentOptionId} onChange={(e) => setDraft({ ...draft, parentOptionId: e.target.value })} className={inp}>
                <option value="">— (كل الأنواع)</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('active')}</label>
          {showAlsawarey && (
            <label className="flex items-center gap-2 pt-1 text-sm sm:col-span-2"><input type="checkbox" checked={draft.allowedOnAlsawarey} onChange={(e) => setDraft({ ...draft, allowedOnAlsawarey: e.target.checked })} />{t('allowedOnAlsawarey')}</label>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={pending} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...EMPTY })} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('add')}</button>
      )}

      <div className="space-y-2">
        {initial.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-graphite/15 p-3">
            <div>
              <span className="font-semibold">{o.nameAr}</span> <span className="text-xs opacity-60" dir="ltr">{o.nameEn}</span>
              {!o.isActive && <span className="ms-1 rounded bg-graphite/10 px-2 py-0.5 text-xs">{t('inactive')}</span>}
              {hasParent && <span className="ms-1 text-xs opacity-60">← {pName(o.parentOptionId)}</span>}
              {showAlsawarey && o.allowedOnAlsawarey && <span className="ms-1 rounded bg-gold/20 px-2 py-0.5 text-xs text-gold-800">{t('onAlsawareyShort')}</span>}
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setDraft({ id: o.id, key: o.key, nameAr: o.nameAr, nameEn: o.nameEn, order: o.order, isActive: o.isActive, parentOptionId: o.parentOptionId ?? '', allowedOnAlsawarey: o.allowedOnAlsawarey })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(o.id)} className="text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
        {initial.length === 0 && <p className="text-sm opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
