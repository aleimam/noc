'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, toast } from '@noc/ui';
import { upsertAmenity, deleteAmenity } from '../actions';

type Photo = { id: string; path: string };
type Row = {
  id: string;
  categoryItemId: string | null;
  category: { ar: string; en: string } | null;
  titleAr: string;
  titleEn: string | null;
  detailsAr: string | null;
  detailsEn: string | null;
  isActive: boolean;
  photos: Photo[];
  placementCount: number;
};
type Cat = { id: string; label: string };
type Draft = {
  id?: string;
  categoryItemId: string;
  titleAr: string;
  titleEn: string;
  detailsAr: string;
  detailsEn: string;
  isActive: boolean;
  photos: Photo[];
};

const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const EMPTY: Draft = { categoryItemId: '', titleAr: '', titleEn: '', detailsAr: '', detailsEn: '', isActive: true, photos: [] };

export function AmenitiesLibraryManager({ initial, categories, locale }: { initial: Row[]; categories: Cat[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  function save() {
    if (!draft || !draft.titleAr.trim()) return;
    start(async () => {
      const r = await upsertAmenity({
        id: draft.id,
        categoryItemId: draft.categoryItemId || null,
        titleAr: draft.titleAr,
        titleEn: draft.titleEn,
        detailsAr: draft.detailsAr,
        detailsEn: draft.detailsEn,
        isActive: draft.isActive,
        photoIds: draft.photos.map((p) => p.id),
      });
      if (r.ok) {
        setDraft(null);
        router.refresh();
        toast(t('savedOk'));
      }
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => {
      await deleteAmenity(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {initial.length === 0 && <li className="text-sm opacity-60">{t('none')}</li>}
        {initial.map((a) => (
          <li key={a.id} className="rounded-lg border border-graphite/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                {a.category && <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{locale === 'ar' ? a.category.ar : a.category.en || a.category.ar}</span>}
                <span className="ms-2 font-semibold">{locale === 'ar' ? a.titleAr : a.titleEn || a.titleAr}</span>
                {!a.isActive && <span className="ms-2 text-xs text-red-600">●</span>}
                <span className="ms-2 text-xs opacity-50" dir="ltr">{a.placementCount} {t('amenityPlacements')}</span>
              </div>
              <span className="flex gap-2 text-xs">
                <button onClick={() => setDraft({ id: a.id, categoryItemId: a.categoryItemId ?? '', titleAr: a.titleAr, titleEn: a.titleEn ?? '', detailsAr: a.detailsAr ?? '', detailsEn: a.detailsEn ?? '', isActive: a.isActive, photos: [...a.photos] })} className="text-accent">{t('edit')}</button>
                <button disabled={pending} onClick={() => del(a.id)} className="text-red-600">{t('delete')}</button>
              </span>
            </div>
            {a.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {a.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.path} alt="" className="h-14 w-14 rounded object-cover ring-1 ring-graphite/15" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="grid gap-2 rounded border border-graphite/15 p-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            {t('amenityCategory')}
            <select value={draft.categoryItemId} onChange={(e) => setDraft({ ...draft, categoryItemId: e.target.value })} className={inp}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-sm">{t('nameAr')}<input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('detailsAr')}<textarea value={draft.detailsAr} onChange={(e) => setDraft({ ...draft, detailsAr: e.target.value })} rows={2} className={inp} /></label>
          <label className="text-sm">{t('detailsEn')}<textarea dir="ltr" value={draft.detailsEn} onChange={(e) => setDraft({ ...draft, detailsEn: e.target.value })} rows={2} className={inp} /></label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            {draft.photos.map((p) => (
              <span key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.path} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-graphite/20" />
                <button type="button" onClick={() => setDraft({ ...draft, photos: draft.photos.filter((x) => x.id !== p.id) })} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">✕</button>
              </span>
            ))}
            <div className="w-28"><ImageAttachment stampCategory="amenity" value={null} onChange={(a) => a && setDraft((d) => (d ? { ...d, photos: [...d.photos, { id: a.id, path: a.path }] } : d))} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('amenityActive')}</label>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={pending} onClick={save} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-2 py-1 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...EMPTY })} className="rounded border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">+ {t('add')}</button>
      )}
    </div>
  );
}
