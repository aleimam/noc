'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { RichEditor } from '../../pages/RichEditor';
import { addGeoUpdate, updateGeoUpdate, deleteGeoUpdate, notifyGeoUpdate } from '../actions';

type Option = { value: string; label: string };
type Row = { id: string; title: string | null; body: string; happenedAt: string; notifiedAt: string | null; author: string | null; area: string };
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

export function UpdatesManager({ options, rows, locale }: { options: Option[]; rows: Row[]; locale: 'ar' | 'en' }) {
  const t = useTranslations('lands');
  const router = useRouter();
  const [pending, start] = useTransition();
  const fmt = (s: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
  const plain = (html: string) => html.replace(/<[^>]+>/g, '').trim();

  // create state
  const [target, setTarget] = useState(options[0]?.value ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [photos, setPhotos] = useState<UploadedAttachment[]>([]);
  // edit state
  const [edit, setEdit] = useState<{ id: string; title: string; body: string; happenedAt: string } | null>(null);

  function create() {
    if (!target || !plain(body)) return;
    const [level, targetId] = target.split(':');
    start(async () => {
      await addGeoUpdate({ level: level as 'district' | 'neighborhood', targetId: targetId!, title: title || undefined, body, happenedAt: happenedAt || undefined, photoIds: photos.map((p) => p.id) });
      setTitle('');
      setBody('');
      setHappenedAt('');
      setPhotos([]);
      router.refresh();
    });
  }
  function saveEdit() {
    if (!edit || !plain(edit.body)) return;
    start(async () => {
      await updateGeoUpdate({ id: edit.id, title: edit.title || undefined, body: edit.body, happenedAt: edit.happenedAt || undefined });
      setEdit(null);
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
    if (!confirm(t('confirmNotifyGeneric'))) return;
    start(async () => {
      await notifyGeoUpdate(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* create */}
      <div className="space-y-2 rounded-lg border border-graphite/15 p-3">
        <h2 className="font-semibold text-primary">{t('addUpdate')}</h2>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={inp}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
          <div className="w-28"><ImageAttachment stampCategory="area-update" value={null} onChange={(a) => a && setPhotos((prev) => [...prev, a])} /></div>
          <button disabled={pending || !plain(body)} onClick={create} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">+ {t('add')}</button>
        </div>
      </div>

      {/* list */}
      <ul className="space-y-2">
        {rows.length === 0 && <li className="text-sm opacity-60">{t('noUpdates')}</li>}
        {rows.map((u) => (
          <li key={u.id} className="rounded-lg border border-graphite/15 p-3">
            {edit?.id === u.id ? (
              <div className="space-y-2">
                <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder={t('updateTitle')} className={inp} />
                <RichEditor value={edit.body} onChange={(v) => setEdit({ ...edit, body: v })} />
                <input type="date" value={edit.happenedAt} onChange={(e) => setEdit({ ...edit, happenedAt: e.target.value })} dir="ltr" className="rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm" />
                <div className="flex gap-2">
                  <button disabled={pending} onClick={saveEdit} className="rounded bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50">{t('save')}</button>
                  <button onClick={() => setEdit(null)} className="px-2 py-1 text-sm opacity-70">{t('cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs opacity-60" dir="ltr">{u.area} · {fmt(u.happenedAt)}{u.author ? ` · ${u.author}` : ''}{u.notifiedAt ? ' · 📣' : ''}</div>
                  <span className="flex gap-3 text-xs">
                    <button onClick={() => setEdit({ id: u.id, title: u.title ?? '', body: u.body, happenedAt: u.happenedAt.slice(0, 10) })} className="text-accent">{t('edit')}</button>
                    <button disabled={pending} onClick={() => del(u.id)} className="text-red-600">{t('delete')}</button>
                  </span>
                </div>
                {u.title && <div className="mt-1 font-bold text-primary">{u.title}</div>}
                <div className="page-content mt-1 text-sm" dangerouslySetInnerHTML={{ __html: u.body }} />
                <div className="mt-2">
                  {u.notifiedAt ? (
                    <span className="text-xs text-green">📣 {t('sent')} · <span dir="ltr">{fmt(u.notifiedAt)}</span></span>
                  ) : (
                    <button disabled={pending} onClick={() => notify(u.id)} className="rounded border border-green/40 px-3 py-1 text-xs font-bold text-green hover:bg-green/10">📣 {t('notifyFollowers')}</button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
