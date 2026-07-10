'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAnalyticsView, deleteAnalyticsView } from './actions';

type View = { id: string; name: string; days: number; site: string };

/** Saved dashboard filter presets: click a chip to apply its (days, site); save the current
 *  filters as a new named preset; delete one with its ×. Staff-shared. */
export function SavedViews({ views, current, locale }: { views: View[]; current: { days: number; site: string }; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const isActive = (v: View) => v.days === current.days && v.site === current.site;

  function save() {
    const n = name.trim();
    if (!n) return;
    start(async () => {
      const r = await saveAnalyticsView(n, current.days, current.site);
      if (r.ok) { setName(''); setNaming(false); router.refresh(); }
    });
  }
  function del(id: string) {
    start(async () => { await deleteAnalyticsView(id); router.refresh(); });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold opacity-60">{L('طرق العرض المحفوظة', 'Saved views')}:</span>
      {views.length === 0 && !naming && <span className="text-xs opacity-40">{L('لا شيء بعد', 'none yet')}</span>}
      {views.map((v) => (
        <span key={v.id} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ${isActive(v) ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>
          <a href={`?days=${v.days}&site=${v.site}`} className="font-semibold">{v.name}</a>
          <button type="button" onClick={() => del(v.id)} disabled={pending} aria-label={L('حذف', 'Delete')} className="leading-none opacity-60 hover:opacity-100">×</button>
        </span>
      ))}
      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setNaming(false); setName(''); } }}
            placeholder={L('اسم العرض', 'View name')}
            maxLength={60}
            className="rounded-md border border-graphite/25 bg-transparent px-2 py-1 text-sm"
          />
          <button type="button" onClick={save} disabled={pending || !name.trim()} className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-soft disabled:opacity-50">{L('حفظ', 'Save')}</button>
          <button type="button" onClick={() => { setNaming(false); setName(''); }} className="text-xs opacity-60">{L('إلغاء', 'cancel')}</button>
        </span>
      ) : (
        <button type="button" onClick={() => setNaming(true)} className="rounded-lg border border-dashed border-graphite/40 px-2.5 py-1 text-sm hover:bg-graphite/10">＋ {L('احفظ العرض الحالي', 'Save current view')}</button>
      )}
    </div>
  );
}
