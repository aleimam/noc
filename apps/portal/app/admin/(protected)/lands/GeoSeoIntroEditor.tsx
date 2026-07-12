'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { saveGeoSeoIntro } from './actions';

const ta = 'w-full rounded border border-graphite/20 bg-transparent px-2 py-1 text-sm';

// AR + EN SEO intro paragraph for a city/district, stored in Setting seo.intro.<level>.<id>.
// Self-contained save (permission 'lands') — independent of the page's other auto-saving
// editors and the global EditSaveBar.
export function GeoSeoIntroEditor({
  level,
  targetId,
  initial,
  locale,
}: {
  level: 'city' | 'district';
  targetId: string;
  initial: { ar: string; en: string };
  locale: 'ar' | 'en';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ar, setAr] = useState(initial.ar);
  const [en, setEn] = useState(initial.en);
  const [saved, setSaved] = useState(false);
  const L = (a: string, e: string) => (locale === 'ar' ? a : e);

  function save() {
    setSaved(false);
    start(async () => {
      const r = await saveGeoSeoIntro(level, targetId, { ar, en });
      if (r.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        {L('نص تعريفي (عربي)', 'Intro (Arabic)')}
        <textarea dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} rows={3} className={ta} />
      </label>
      <label className="block text-sm">
        {L('نص تعريفي (إنجليزي)', 'Intro (English)')}
        <textarea dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} rows={3} className={ta} />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-1.5 text-sm text-soft disabled:opacity-50">
          {pending ? '…' : L('حفظ النص', 'Save intro')}
        </button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
      <p className="text-xs opacity-60">
        {L('فقرة قصيرة تظهر أعلى الصفحة العامة لتحسين الظهور في محركات البحث (اختياري).', 'A short paragraph shown at the top of the public page to improve search visibility (optional).')}
      </p>
    </div>
  );
}
