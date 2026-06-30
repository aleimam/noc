'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { upsertAmenityType, deleteAmenityType } from '../actions';

type Row = { id: string; titleAr: string; titleEn: string; order: number; isActive: boolean; count: number };
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function AmenityTypesManager({ types, locale }: { types: Row[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ id?: string; titleAr: string; titleEn: string; order: number } | null>(null);

  function save() {
    if (!draft?.titleAr.trim()) return;
    start(async () => {
      await upsertAmenityType({ id: draft.id, titleAr: draft.titleAr, titleEn: draft.titleEn, order: draft.order });
      setDraft(null);
      router.refresh();
    });
  }
  function del(r: Row) {
    if (r.count > 0) {
      alert(t('amenityTypeInUse'));
      return;
    }
    if (!confirm(t('confirmDelete'))) return;
    start(async () => {
      await deleteAmenityType(r.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-graphite/10 rounded-lg border border-graphite/15">
        {types.length === 0 && <li className="p-3 text-sm opacity-60">{t('none')}</li>}
        {types.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>{locale === 'ar' ? r.titleAr : r.titleEn || r.titleAr} <span className="opacity-50">· {r.count}</span></span>
            <span className="flex gap-3">
              <button onClick={() => setDraft({ id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, order: r.order })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(r)} className="text-red-600">{t('delete')}</button>
            </span>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="grid gap-2 rounded border border-graphite/15 p-3 sm:grid-cols-2">
          <label className="text-sm">{t('nameAr')}<input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} className={inp} /></label>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={pending} onClick={save} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-2 py-1 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ titleAr: '', titleEn: '', order: types.length })} className="rounded border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">+ {t('add')}</button>
      )}
    </div>
  );
}
