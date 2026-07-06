'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type AttrType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'PHOTOS' | 'DOCUMENTS'
  | 'URL' | 'PHONE' | 'DATE_FULL' | 'MONEY' | 'MONEY_THOUSANDS' | 'AREA_ORIGINAL' | 'AREA_ALLOCATED' | 'YESNO'
  | 'DISTRICT' | 'NEIGHBORHOOD';
type Opt = { id?: string; key: string; labelAr: string; labelEn: string };
type Result = { ok: true } | { ok: false; error: string };
type ClassifierData = { id: string; nameAr: string; nameEn: string; options: { id: string; nameAr: string; nameEn: string }[] };
type AttrConfig = { yesLabelAr?: string; yesLabelEn?: string; noLabelAr?: string; noLabelEn?: string; multiple?: boolean };

export type AttrData = {
  id?: string;
  key: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  type: AttrType;
  unit: string;
  helpAr: string;
  helpEn: string;
  config: AttrConfig;
  filterable: boolean;
  order: number;
  isActive: boolean;
  options: Opt[];
  optionListId: string; // shared OptionList for SELECT / MULTI_SELECT ('' = none)
  optionIds: string[]; // ClassifierOption ids the attribute applies to
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const cell = 'flex-1 rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

// Friendly Arabic labels for the value-type picker (raw enum shown in parens for reference).
const TYPE_LABELS: Record<AttrType, string> = {
  TEXT: 'نص قصير', TEXTAREA: 'نص طويل', NUMBER: 'رقم', BOOLEAN: 'مربع اختيار',
  SELECT: 'اختيار من قائمة', MULTI_SELECT: 'اختيار متعدد', DATE: 'تاريخ (شهر/سنة)',
  DATE_FULL: 'تاريخ (يوم/شهر/سنة)', PHOTOS: 'صور (عامة)', DOCUMENTS: 'مستندات (داخلية)',
  URL: 'رابط', PHONE: 'رقم هاتف', MONEY: 'مبلغ بالجنيه', MONEY_THOUSANDS: 'مبلغ بالآلاف',
  AREA_ORIGINAL: 'مساحة أصلية (م²)', AREA_ALLOCATED: 'مساحة مخصصة (م²)', YESNO: 'مفتاح نعم/لا',
  DISTRICT: 'المنطقة (من قاعدة المناطق)', NEIGHBORHOOD: 'المجاورة (تتبع المنطقة)',
};
const ATTR_TYPES: AttrType[] = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'YESNO',
  'URL', 'PHONE', 'DATE', 'DATE_FULL', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED',
  'DISTRICT', 'NEIGHBORHOOD',
  'PHOTOS', 'DOCUMENTS',
];

export function AttributeForm({
  initial,
  sections,
  classifiers,
  lists,
  action,
  remove,
}: {
  initial: AttrData;
  sections: { id: string; nameAr: string; nameEn: string }[];
  classifiers: ClassifierData[];
  lists: { id: string; name: string }[];
  action: (i: AttrData) => Promise<Result>;
  remove?: (id: string) => Promise<Result>;
}) {
  const t = useTranslations('mp');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<AttrData>(initial);
  const [error, setError] = useState('');
  const set = (patch: Partial<AttrData>) => setF((x) => ({ ...x, ...patch }));
  const setCfg = (patch: Partial<AttrConfig>) => setF((x) => ({ ...x, config: { ...x.config, ...patch } }));
  const hasOptions = f.type === 'SELECT' || f.type === 'MULTI_SELECT';
  const isAttachment = f.type === 'PHOTOS' || f.type === 'DOCUMENTS';

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

  // Hard-delete this attribute. Cascades remove its option-list links, category
  // applicability, and any saved listing values, so any attribute can be removed.
  function del() {
    if (!initial.id || !remove) return;
    if (!window.confirm(t('confirmDeleteAttr'))) return;
    setError('');
    start(async () => {
      const r = await remove(initial.id!);
      if (r.ok) router.push('/admin/marketplace/attributes');
      else setError(r.error === 'in_use' ? t('inUse') : r.error);
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
            {ATTR_TYPES.map((x) => (<option key={x} value={x}>{TYPE_LABELS[x]} ({x})</option>))}
          </select>
        </label>
        <label className="text-sm">{t('unit')}<input value={f.unit} onChange={(e) => set({ unit: e.target.value })} className={inp} /></label>
      </div>

      {/* Optional bilingual description shown as help under the field. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">{t('descAr')}<input value={f.helpAr} onChange={(e) => set({ helpAr: e.target.value })} className={inp} /></label>
        <label className="text-sm">{t('descEn')}<input dir="ltr" value={f.helpEn} onChange={(e) => set({ helpEn: e.target.value })} className={inp} /></label>
      </div>

      {/* Yes/No switch — labels for each state. */}
      {f.type === 'YESNO' && (
        <div className="grid gap-4 rounded-lg border border-graphite/15 p-3 sm:grid-cols-2">
          <label className="text-sm">{t('yesLabel')} ({t('labelAr')})<input value={f.config.yesLabelAr ?? ''} onChange={(e) => setCfg({ yesLabelAr: e.target.value })} placeholder="نعم" className={inp} /></label>
          <label className="text-sm">{t('yesLabel')} ({t('labelEn')})<input dir="ltr" value={f.config.yesLabelEn ?? ''} onChange={(e) => setCfg({ yesLabelEn: e.target.value })} placeholder="Yes" className={inp} /></label>
          <label className="text-sm">{t('noLabel')} ({t('labelAr')})<input value={f.config.noLabelAr ?? ''} onChange={(e) => setCfg({ noLabelAr: e.target.value })} placeholder="لا" className={inp} /></label>
          <label className="text-sm">{t('noLabel')} ({t('labelEn')})<input dir="ltr" value={f.config.noLabelEn ?? ''} onChange={(e) => setCfg({ noLabelEn: e.target.value })} placeholder="No" className={inp} /></label>
        </div>
      )}

      {/* Attachment cardinality for PHOTOS / DOCUMENTS. */}
      {isAttachment && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.config.multiple ?? true} onChange={(e) => setCfg({ multiple: e.target.checked })} />
          {t('allowMultiple')}
        </label>
      )}

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.filterable} onChange={(e) => set({ filterable: e.target.checked })} /> {t('filterable')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> {t('active')}</label>
        <label className="flex items-center gap-2">{t('order')} <input type="number" value={f.order} onChange={(e) => set({ order: +e.target.value })} className="w-20 rounded-md border border-graphite/20 bg-transparent px-2 py-1" /></label>
      </div>

      {/* SELECT / MULTI_SELECT draw their choices from a shared, reusable Option List. */}
      {hasOptions && (
        <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('optionList')}</h3>
            <a href="/admin/marketplace/option-lists" target="_blank" className="text-xs text-accent">{t('manageLists')} ↗</a>
          </div>
          <select value={f.optionListId} onChange={(e) => set({ optionListId: e.target.value })} className={inp}>
            <option value="">—</option>
            {lists.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
          <p className="text-xs opacity-60">{t('optionListPickHint')}</p>
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

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={submit} className="rounded-md bg-primary px-4 py-2 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        <a href="/admin/marketplace/attributes" className="rounded-md border border-graphite/25 px-4 py-2 text-sm">{t('cancel')}</a>
        {initial.id && remove && (
          <button type="button" disabled={pending} onClick={del} className="ms-auto rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
            {t('delete')}
          </button>
        )}
      </div>
    </div>
  );
}
