'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, Badge, type UploadedAttachment } from '@noc/ui';
import { upsertNews, deleteNews } from './actions';

type Cat = 'FACILITIES' | 'ROADS' | 'HANDOVERS' | 'REGULATIONS' | 'GENERAL';
type Row = { id: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; category: Cat; pinned: boolean; published: boolean; photos: UploadedAttachment[] };
type Draft = Omit<Row, 'id'> & { id?: string };

const CATS: Cat[] = ['GENERAL', 'FACILITIES', 'ROADS', 'HANDOVERS', 'REGULATIONS'];
const inp = 'w-full rounded-md border border-ink-200 bg-transparent px-3 py-2 text-sm';
const EMPTY: Draft = { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', category: 'GENERAL', pinned: false, published: true, photos: [] };

export function NewsManager({ initial }: { initial: Row[] }) {
  const t = useTranslations('news');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  function save() {
    if (!draft) return;
    setError('');
    start(async () => {
      const r = await upsertNews({ ...draft, photoIds: draft.photos.map((p) => p.id) });
      if (r.ok) { setDraft(null); router.refresh(); } else setError(r.error);
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => { await deleteNews(id); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!draft && (
        <button onClick={() => setDraft({ ...EMPTY })} className="rounded-md bg-navy px-4 py-2 text-sm font-bold text-soft">+ {t('addNews')}</button>
      )}

      {draft && (
        <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('titleAr')}<input value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('titleEn')}<input dir="ltr" value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} className={inp} /></label>
            <label className="text-sm">{t('category')}
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Cat })} className={inp}>
                {CATS.map((c) => <option key={c} value={c}>{t(`cat${c}`)}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> {t('publishedFlag')}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /> {t('pinned')}</label>
            </div>
          </div>
          <label className="block text-sm">{t('bodyAr')}<textarea value={draft.bodyAr} onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })} rows={4} className={inp} /></label>
          <label className="block text-sm">{t('bodyEn')}<textarea dir="ltr" value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} rows={3} className={inp} /></label>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t('photos')}</span>
            <div className="flex flex-wrap gap-2">
              {draft.photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.path} alt="" className="h-16 w-16 rounded object-cover ring-1 ring-ink-200" />
                  <button type="button" onClick={() => setDraft({ ...draft, photos: draft.photos.filter((x) => x.id !== p.id) })} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">✕</button>
                </div>
              ))}
              <div className="w-40"><ImageAttachment value={null} onChange={(a) => a && setDraft((d) => (d ? { ...d, photos: [...d.photos, a] } : d))} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={pending || !draft.titleAr.trim()} onClick={save} className="rounded-md bg-navy px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">{tc('save')}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-sm opacity-70">{tc('cancel')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {initial.length === 0 && <p className="text-sm opacity-60">{t('none')}</p>}
        {initial.map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-navy-800">{n.titleAr}</span>
                <Badge tone="navy" size="sm">{t(`cat${n.category}`)}</Badge>
                {n.pinned && <Badge tone="gold" size="sm">{t('pinned')}</Badge>}
                {!n.published && <Badge tone="neutral" size="sm">{t('draft')}</Badge>}
              </div>
              <div className="truncate text-xs text-ink-500">{n.bodyAr}</div>
            </div>
            <div className="flex flex-none items-center gap-2">
              <button onClick={() => setDraft({ ...n })} className="px-2 py-1 text-sm text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(n.id)} className="px-2 py-1 text-sm text-red-600">{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
