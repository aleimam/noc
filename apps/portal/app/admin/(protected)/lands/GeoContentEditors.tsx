'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ImageAttachment, Lightbox, type UploadedAttachment } from '@noc/ui';
import { RichEditor } from '../pages/RichEditor';
import {
  addGeoUpdate,
  deleteGeoUpdate,
  upsertAdvantage,
  deleteAdvantage,
  setAreaMap,
  clearAreaMap,
  notifyGeoUpdate,
  setDistrictAdjacency,
  setNeighborhoodAdjacency,
} from './actions';

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

type MapTriplet = { clean: string; alswarey: string | null; newobour: string | null };

/** Upload one clean map; the system stores it + a stamped copy per brand. */
export function AreaMapEditor({ level, targetId, kind, map }: { level: Level; targetId: string; kind: 'location' | 'masterplan'; map: MapTriplet | null }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="space-y-2">
      <p className="text-xs opacity-60">{t('mapHint')}</p>
      <ImageAttachment
        value={map ? { id: '', path: map.clean, originalName: '' } : null}
        onChange={(a) =>
          start(async () => {
            if (a) await setAreaMap({ level, targetId, kind, attachmentId: a.id });
            else await clearAreaMap({ level, targetId, kind });
            router.refresh();
          })
        }
      />
      {map && (map.alswarey || map.newobour) && (
        <div className="flex flex-wrap gap-3">
          {map.alswarey && <MapThumb label={t('copyAlswarey')} src={map.alswarey} />}
          {map.newobour && <MapThumb label={t('copyNewobour')} src={map.newobour} />}
        </div>
      )}
    </div>
  );
}

function MapThumb({ label, src }: { label: string; src: string }) {
  return (
    <figure className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-24 w-32 rounded object-cover ring-1 ring-graphite/20" />
      <figcaption className="mt-1 text-xs opacity-70">{label}</figcaption>
    </figure>
  );
}

/** Reciprocal adjacency picker (admin-only). */
export function AdjacencyEditor({ level, targetId, candidates, selected }: { level: Level; targetId: string; candidates: { id: string; name: string }[]; selected: string[] }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set(selected));
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => {
    setSaved(false);
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  function save() {
    start(async () => {
      const ids = [...sel];
      await (level === 'district' ? setDistrictAdjacency(targetId, ids) : setNeighborhoodAdjacency(targetId, ids));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs opacity-60">{t('adjacencyHint')}</p>
      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded border border-graphite/15 p-2">
        {candidates.length === 0 && <span className="text-sm opacity-60">{t('none')}</span>}
        {candidates.map((c) => (
          <label key={c.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${sel.has(c.id) ? 'border-primary bg-primary text-soft' : 'border-graphite/25'}`}>
            <input type="checkbox" className="hidden" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded bg-primary px-4 py-1.5 text-sm text-soft disabled:opacity-50">{t('save')}</button>
        {saved && <span className="text-sm text-green">{t('saved') ?? '✓'}</span>}
      </div>
    </div>
  );
}

type UpdateRow = { id: string; title: string | null; body: string; happenedAt: string; notifiedAt: string | null; photos: string[]; author: string | null };

export function UpdatesEditor({ level, targetId, updates, followerCount, locale }: { level: Level; targetId: string; updates: UpdateRow[]; followerCount: number; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [photos, setPhotos] = useState<UploadedAttachment[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);

  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
  const plain = (html: string) => html.replace(/<[^>]+>/g, '').trim();

  function add() {
    if (!plain(body)) return;
    start(async () => {
      await addGeoUpdate({ level, targetId, title: title || undefined, body, happenedAt: happenedAt || undefined, photoIds: photos.map((p) => p.id) });
      setTitle('');
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
  function notify(id: string) {
    if (!confirm(`${t('confirmNotify')} (${followerCount})`)) return;
    start(async () => {
      await notifyGeoUpdate(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('updateTitle')} className={inp} />
        <RichEditor value={body} onChange={setBody} />
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
          <button disabled={pending || !plain(body)} onClick={add} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">+ {t('add')}</button>
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
            {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
            <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
            {u.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {u.photos.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" onClick={() => setZoom(src)} className="h-16 w-16 cursor-pointer rounded object-cover ring-1 ring-graphite/15" />
                ))}
              </div>
            )}
            <div className="mt-2">
              {u.notifiedAt ? (
                <span className="text-xs text-green">📣 {t('sent')} · <span dir="ltr">{fmt(u.notifiedAt)}</span></span>
              ) : (
                <button disabled={pending} onClick={() => notify(u.id)} className="rounded border border-green/40 px-3 py-1 text-xs font-bold text-green hover:bg-green/10">
                  📣 {t('notifyFollowers')} ({followerCount})
                </button>
              )}
            </div>
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
            {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
            <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
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
