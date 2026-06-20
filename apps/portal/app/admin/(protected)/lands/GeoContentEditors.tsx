'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ImageAttachment, Lightbox, type UploadedAttachment } from '@noc/ui';
import { addGeoUpdate, deleteGeoUpdate, upsertAdvantage, deleteAdvantage, setMasterplan, clearMasterplan } from './actions';

type Level = 'district' | 'neighborhood';
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function AdvantagesEditor({
  level,
  targetId,
  advantages,
  locale,
}: {
  level: Level;
  targetId: string;
  advantages: { id: string; textAr: string; textEn: string | null; order: number }[];
  locale: 'ar' | 'en';
}) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ id?: string; textAr: string; textEn: string } | null>(null);

  function save() {
    if (!draft?.textAr.trim()) return;
    start(async () => {
      await upsertAdvantage({ id: draft.id, level, targetId, textAr: draft.textAr, textEn: draft.textEn, order: advantages.length });
      setDraft(null);
      router.refresh();
    });
  }
  function del(id: string) {
    start(async () => {
      await deleteAdvantage(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {advantages.length === 0 && <li className="text-sm opacity-60">{t('none')}</li>}
        {advantages.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-graphite/15 px-3 py-1.5 text-sm">
            <span>{locale === 'ar' ? a.textAr : a.textEn || a.textAr}</span>
            <span className="flex gap-2">
              <button onClick={() => setDraft({ id: a.id, textAr: a.textAr, textEn: a.textEn ?? '' })} className="text-accent">{t('edit')}</button>
              <button disabled={pending} onClick={() => del(a.id)} className="text-red-600">{t('delete')}</button>
            </span>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="grid gap-2 rounded border border-graphite/15 p-3 sm:grid-cols-2">
          <label className="text-sm">{t('nameAr')}<input value={draft.textAr} onChange={(e) => setDraft({ ...draft, textAr: e.target.value })} className={inp} /></label>
          <label className="text-sm">{t('nameEn')}<input dir="ltr" value={draft.textEn} onChange={(e) => setDraft({ ...draft, textEn: e.target.value })} className={inp} /></label>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={pending} onClick={save} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setDraft(null)} className="px-2 py-1 text-sm opacity-70">{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ textAr: '', textEn: '' })} className="rounded border border-graphite/25 px-3 py-1 text-sm hover:bg-graphite/10">+ {t('add')}</button>
      )}
    </div>
  );
}

export function MasterplanEditor({ level, targetId, current }: { level: Level; targetId: string; current: UploadedAttachment | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <ImageAttachment
      value={current}
      onChange={(a) =>
        start(async () => {
          if (a) await setMasterplan({ level, targetId, attachmentId: a.id });
          else await clearMasterplan({ level, targetId });
          router.refresh();
        })
      }
    />
  );
}

type UpdateRow = { id: string; body: string; happenedAt: string; photos: string[]; author: string | null };

export function UpdatesEditor({ level, targetId, updates, locale }: { level: Level; targetId: string; updates: UpdateRow[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [photos, setPhotos] = useState<UploadedAttachment[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);

  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));

  function add() {
    if (!body.trim()) return;
    start(async () => {
      await addGeoUpdate({ level, targetId, body, happenedAt: happenedAt || undefined, photoIds: photos.map((p) => p.id) });
      setBody('');
      setHappenedAt('');
      setPhotos([]);
      router.refresh();
    });
  }
  function del(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    start(async () => {
      await deleteGeoUpdate(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('updates')} rows={2} className={inp} />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} dir="ltr" className="rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm" />
          {photos.map((p) => (
            <span key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-graphite/20" />
              <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">✕</button>
            </span>
          ))}
          <div className="w-28"><ImageAttachment value={null} onChange={(a) => a && setPhotos((prev) => [...prev, a])} /></div>
          <button disabled={pending || !body.trim()} onClick={add} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">+ {t('add')}</button>
        </div>
      </div>

      <ul className="space-y-2">
        {updates.length === 0 && <li className="text-sm opacity-60">{t('noUpdates')}</li>}
        {updates.map((u) => (
          <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)}{u.author ? ` · ${u.author}` : ''}</div>
              <button disabled={pending} onClick={() => del(u.id)} className="text-xs text-red-600">{t('delete')}</button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{u.body}</p>
            {u.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {u.photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" onClick={() => setZoom(src)} className="h-16 w-16 cursor-pointer rounded object-cover ring-1 ring-graphite/15" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Read-only timeline for inherited updates (shown on lower levels). */
export function InheritedUpdates({ updates, locale, sourceLabel }: { updates: UpdateRow[]; locale: 'ar' | 'en'; sourceLabel: string }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
  if (updates.length === 0) return null;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {updates.map((u) => (
          <li key={u.id} className="rounded-lg border border-dashed border-graphite/25 p-3">
            <div className="text-xs opacity-60" dir="ltr">{fmt(u.happenedAt)} · {sourceLabel}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{u.body}</p>
            {u.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {u.photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" onClick={() => setZoom(src)} className="h-16 w-16 cursor-pointer rounded object-cover ring-1 ring-graphite/15" />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
