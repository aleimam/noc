'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from '@noc/ui';

type Result = { ok: true } | { ok: false; error: string };
type ParentOpt = { id: string; nameAr: string; nameEn: string };
type Opt = { id: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean; parentIds: string[]; allowedOnAlsawarey: boolean };
type Draft = { id?: string; key: string; nameAr: string; nameEn: string; order: number; isActive: boolean; parentIds: string[]; allowedOnAlsawarey: boolean };

const EMPTY: Draft = { key: '', nameAr: '', nameEn: '', order: 0, isActive: true, parentIds: [], allowedOnAlsawarey: true };
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function ClassifierOptionsEditor({
  initial,
  parentOptions,
  parentLabel,
  showAlsawarey,
  upsert,
  remove,
  toggleFlag,
}: {
  initial: Opt[];
  parentOptions: ParentOpt[];
  parentLabel: string;
  showAlsawarey: boolean;
  upsert: (input: Draft) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  toggleFlag: (id: string, flag: 'isActive' | 'allowedOnAlsawarey', value: boolean) => Promise<Result>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const hasParent = parentOptions.length > 0 || initial.some((o) => o.parentIds.length);
  const pNames = (ids: string[]) => {
    const names = ids.map((id) => parentOptions.find((x) => x.id === id)?.nameAr).filter(Boolean);
    return names.length ? names.join('، ') : '—';
  };
  const toggleParent = (id: string) =>
    setDraft((d) => (d ? { ...d, parentIds: d.parentIds.includes(id) ? d.parentIds.filter((x) => x !== id) : [...d.parentIds, id] } : d));
  const allParentsSelected = !!draft && parentOptions.length > 0 && draft.parentIds.length === parentOptions.length;
  const toggleAllParents = () =>
    setDraft((d) => (d ? { ...d, parentIds: allParentsSelected ? [] : parentOptions.map((p) => p.id) } : d));

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

  function flip(id: string, flag: 'isActive' | 'allowedOnAlsawarey', value: boolean) {
    start(async () => {
      const r = await toggleFlag(id, flag, value);
      if (r.ok) { router.refresh(); toast(t('savedOk')); }
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
            <div className="text-sm sm:col-span-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span>{parentLabel} (الأصل) <span className="opacity-60">— {t('parentMultiHint')}</span></span>
                <button type="button" onClick={toggleAllParents} className="whitespace-nowrap text-xs text-accent hover:underline">
                  {allParentsSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-graphite/20 p-2 sm:grid-cols-3">
                {parentOptions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.parentIds.includes(p.id)} onChange={() => toggleParent(p.id)} />
                    {p.nameAr}
                  </label>
                ))}
              </div>
              {draft.parentIds.length === 0 && <p className="mt-1 text-xs opacity-60">{t('parentNoneHint')}</p>}
            </div>
          )}
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('active')}</label>
          {showAlsawarey && (
            <label className="flex items-center gap-2 pt-1 text-sm sm:col-span-2"><input type="checkbox" checked={draft.allowedOnAlsawarey} onChange={(e) => setDraft({ ...draft, allowedOnAlsawarey: e.target.checked })} />{t('allowedOnAlsawarey')}</label>
          )}
          {/* Attribute applicability is managed centrally in /admin/marketplace/category-attributes
              (single source of truth) — removed the duplicate grid here (owner decision 2026-07-09). */}
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
            <div className="flex items-center gap-2.5">
              {/* Active toggle: green check when active, grey when not. */}
              <button
                type="button"
                disabled={pending}
                title={o.isActive ? t('active') : t('inactive')}
                onClick={() => flip(o.id, 'isActive', !o.isActive)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${o.isActive ? 'bg-green/15 text-green' : 'bg-graphite/10 text-graphite/40'}`}
              >
                ✓
              </button>
              {/* Al Sawarey toggle: full-color logo when allowed, greyscale when not. */}
              {showAlsawarey && (
                <button
                  type="button"
                  disabled={pending}
                  title={o.allowedOnAlsawarey ? t('allowedOnAlsawarey') : t('onAlsawareyShort')}
                  onClick={() => flip(o.id, 'allowedOnAlsawarey', !o.allowedOnAlsawarey)}
                  className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full ring-1 ring-graphite/15"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/alsawarey-logo"
                    alt="Al Sawarey"
                    className="h-full w-full object-contain"
                    style={{ filter: o.allowedOnAlsawarey ? 'none' : 'grayscale(1)', opacity: o.allowedOnAlsawarey ? 1 : 0.4 }}
                  />
                </button>
              )}
              <div>
                <span className="font-semibold">{o.nameAr}</span> <span className="text-xs opacity-60" dir="ltr">{o.nameEn}</span>
                {hasParent && o.parentIds.length > 0 && <span className="ms-1 text-xs opacity-60">← {pNames(o.parentIds)}</span>}
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => setDraft({ id: o.id, key: o.key, nameAr: o.nameAr, nameEn: o.nameEn, order: o.order, isActive: o.isActive, parentIds: [...o.parentIds], allowedOnAlsawarey: o.allowedOnAlsawarey })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(o.id)} className="text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
        {initial.length === 0 && <p className="text-sm opacity-50">{t('none')}</p>}
      </div>
    </div>
  );
}
