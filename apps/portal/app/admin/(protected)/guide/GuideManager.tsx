'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertGuideEntry, deleteGuideEntry } from './actions';

type Sec = 'LICENSING' | 'HANDOVER' | 'COMPANIES' | 'COSTS';
type Row = { id: string; section: Sec; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; order: number; isActive: boolean };
type Draft = Omit<Row, 'id'> & { id?: string };

const SECS: Sec[] = ['LICENSING', 'HANDOVER', 'COMPANIES', 'COSTS'];
const inp = 'w-full rounded-md border border-ink-200 bg-transparent px-3 py-2 text-sm';
const EMPTY: Draft = { section: 'LICENSING', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', order: 0, isActive: true };

export function GuideManager({ initial }: { initial: Row[] }) {
  const t = useTranslations('guide');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertGuideEntry(draft);
      if (r.ok) { setDraft(null); router.refresh(); } else setError(r.error);
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => { await deleteGuideEntry(id); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!draft && <button onClick={() => setDraft({ ...EMPTY })} className="rounded-md bg-navy px-4 py-2 text-sm font-bold text-soft">+ {t('addEntry')}</button>}

      {draft && (
        <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('section')}<select value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value as Sec })} className={inp}>{SECS.map((s) => <option key={s} value={s}>{t(`sec${s}`)}</option>)}</select></label>
            <label className="text-sm">{t('order')}<input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: +e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('titleAr')}<input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('titleEn')}<input dir="ltr" value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} className={inp} /></label>
          </div>
          <label className="block text-sm">{t('bodyAr')}<textarea value={draft.bodyAr} onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })} rows={4} className={inp} /></label>
          <label className="block text-sm">{t('bodyEn')}<textarea dir="ltr" value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} rows={3} className={inp} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> {t('active')}</label>
          <div className="flex gap-2">
            <button disabled={pending || !draft.titleAr.trim()} onClick={save} className="rounded-md bg-navy px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {initial.length === 0 && <p className="text-sm opacity-60">{t('none')}</p>}
        {initial.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">{t(`sec${g.section}`)}</span>
                <span className="truncate font-semibold text-navy-800">{g.titleAr}</span>
                {!g.isActive && <span className="text-xs text-red-500">({t('hidden')})</span>}
              </div>
            </div>
            <div className="flex flex-none gap-2">
              <button onClick={() => setDraft({ ...g })} className="px-2 py-1 text-sm text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(g.id)} className="px-2 py-1 text-sm text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
