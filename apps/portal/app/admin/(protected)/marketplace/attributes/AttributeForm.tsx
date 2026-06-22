'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type AttrType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS';
type Opt = { id?: string; key: string; labelAr: string; labelEn: string };
type Result = { ok: true } | { ok: false; error: string };
type ClassifierData = { id: string; nameAr: string; nameEn: string; options: { id: string; nameAr: string; nameEn: string }[] };

export type AttrData = {
  id?: string;
  key: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  type: AttrType;
  unit: string;
  filterable: boolean;
  order: number;
  isActive: boolean;
  options: Opt[];
  optionIds: string[]; // ClassifierOption ids the attribute applies to
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const cell = 'flex-1 rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';
const ATTR_TYPES: AttrType[] = ['TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'DATE', 'PHOTOS', 'DOCUMENTS'];

export function AttributeForm({
  initial,
  sections,
  classifiers,
  action,
}: {
  initial: AttrData;
  sections: { id: string; nameAr: string; nameEn: string }[];
  classifiers: ClassifierData[];
  action: (i: AttrData) => Promise<Result>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<AttrData>(initial);
  const [error, setError] = useState('');
  const set = (patch: Partial<AttrData>) => setF((x) => ({ ...x, ...patch }));
  const hasOptions = f.type === 'SELECT' || f.type === 'MULTI_SELECT';

  const toggle = (id: string) =>
    set({ optionIds: f.optionIds.includes(id) ? f.optionIds.filter((x) => x !== id) : [...f.optionIds, id] });

  function submit() {
    setError('');
    if (!f.key.trim() || !f.sectionId || !f.labelAr.trim() || !f.labelEn.trim()) {
      setError('failed');
      return;
    }
    start(async () => {
      const r = await action(f);
      if (r.ok) router.push('/admin/marketplace/attributes');
      else setError(r.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          {t('key')}
          <input dir="ltr" value={f.key} disabled={!!initial.id} onChange={(e) => set({ key: e.target.value })} className={inp + (initial.id ? ' opacity-60' : '')} />
        </label>
        <label className="text-sm">
          {t('section')}
          <select value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })} className={inp}>
            <option value="">—</option>
            {sections.map((s) => (<option key={s.id} value={s.id}>{s.nameAr} / {s.nameEn}</option>))}
          </select>
        </label>
        <label className="text-sm">{t('labelAr')}<input value={f.labelAr} onChange={(e) => set({ labelAr: e.target.value })} className={inp} /></label>
        <label className="text-sm">{t('labelEn')}<input dir="ltr" value={f.labelEn} onChange={(e) => set({ labelEn: e.target.value })} className={inp} /></label>
        <label className="text-sm">
          {t('fieldType')}
          <select value={f.type} onChange={(e) => set({ type: e.target.value as AttrType })} className={inp}>
            {ATTR_TYPES.map((x) => (<option key={x} value={x}>{x}</option>))}
          </select>
        </label>
        <label className="text-sm">{t('unit')}<input value={f.unit} onChange={(e) => set({ unit: e.target.value })} className={inp} /></label>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.filterable} onChange={(e) => set({ filterable: e.target.checked })} /> {t('filterable')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> {t('active')}</label>
        <label className="flex items-center gap-2">{t('order')} <input type="number" value={f.order} onChange={(e) => set({ order: +e.target.value })} className="w-20 rounded-md border border-graphite/20 bg-transparent px-2 py-1" /></label>
      </div>

      {hasOptions && (
        <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('options')}</h3>
            <button onClick={() => set({ options: [...f.options, { key: '', labelAr: '', labelEn: '' }] })} className="rounded border border-graphite/25 px-2 py-1 text-xs">+ {t('add')}</button>
          </div>
          {f.options.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input dir="ltr" placeholder={t('key')} value={o.key} onChange={(e) => { const c = [...f.options]; c[i] = { ...o, key: e.target.value }; set({ options: c }); }} className="w-28 rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm" />
              <input placeholder={t('labelAr')} value={o.labelAr} onChange={(e) => { const c = [...f.options]; c[i] = { ...o, labelAr: e.target.value }; set({ options: c }); }} className={cell} />
              <input dir="ltr" placeholder={t('labelEn')} value={o.labelEn} onChange={(e) => { const c = [...f.options]; c[i] = { ...o, labelEn: e.target.value }; set({ options: c }); }} className={cell} />
              <button onClick={() => set({ options: f.options.filter((_, j) => j !== i) })} className="px-1 text-red-600">✕</button>
            </div>
          ))}
          {f.options.length === 0 && <p className="text-xs opacity-50">{t('none')}</p>}
        </div>
      )}

      {/* Applicability — tick the Type / Purpose / Condition values this property applies to.
          Leaving a classifier blank means it applies to ALL of that classifier's values. */}
      <div className="space-y-3 rounded-lg border border-graphite/15 p-3">
        <h3 className="font-semibold">{t('appliesTo')}</h3>
        <p className="text-xs opacity-60">{t('appliesHint')}</p>
        {classifiers.map((c) => {
          const all = c.options.length > 0 && c.options.every((o) => f.optionIds.includes(o.id));
          return (
            <div key={c.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.nameAr} / {c.nameEn}</span>
                <button
                  type="button"
                  onClick={() => set({ optionIds: all ? f.optionIds.filter((id) => !c.options.some((o) => o.id === id)) : [...new Set([...f.optionIds, ...c.options.map((o) => o.id)])] })}
                  className="rounded border border-graphite/25 px-2 py-0.5 text-xs"
                >
                  {all ? t('clear') : t('selectAll')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {c.options.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.optionIds.includes(o.id)} onChange={() => toggle(o.id)} />
                    {o.nameAr}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button disabled={pending} onClick={submit} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        <a href="/admin/marketplace/attributes" className="rounded-md border border-graphite/25 px-4 py-2 text-sm">{t('cancel')}</a>
      </div>
    </div>
  );
}
