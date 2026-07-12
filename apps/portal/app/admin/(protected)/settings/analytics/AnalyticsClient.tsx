'use client';

import { useState, useTransition } from 'react';
import { saveAnalytics } from './actions';

const FIELDS: { key: string; ar: string; en: string; ph: string }[] = [
  { key: 'ga4_newobour', ar: 'العبور الجديدة — GA4 Measurement ID', en: 'New Obour — GA4 Measurement ID', ph: 'G-XXXXXXXXXX' },
  { key: 'pixel_newobour', ar: 'العبور الجديدة — Meta Pixel ID', en: 'New Obour — Meta Pixel ID', ph: '1234567890' },
  { key: 'gsc_newobour', ar: 'العبور الجديدة — Google verification', en: 'New Obour — Google verification', ph: 'google-site-verification token' },
  { key: 'bing_newobour', ar: 'العبور الجديدة — تحقق Bing (msvalidate.01)', en: 'New Obour — Bing verification (msvalidate.01)', ph: 'msvalidate.01 token' },
  { key: 'yandex_newobour', ar: 'العبور الجديدة — تحقق Yandex', en: 'New Obour — Yandex verification', ph: 'yandex-verification token' },
  { key: 'ga4_alsawarey', ar: 'الصواري — GA4 Measurement ID', en: 'Al Sawarey — GA4 Measurement ID', ph: 'G-XXXXXXXXXX' },
  { key: 'pixel_alsawarey', ar: 'الصواري — Meta Pixel ID', en: 'Al Sawarey — Meta Pixel ID', ph: '1234567890' },
  { key: 'gsc_alsawarey', ar: 'الصواري — Google verification', en: 'Al Sawarey — Google verification', ph: 'google-site-verification token' },
  { key: 'bing_alsawarey', ar: 'الصواري — تحقق Bing (msvalidate.01)', en: 'Al Sawarey — Bing verification (msvalidate.01)', ph: 'msvalidate.01 token' },
  { key: 'yandex_alsawarey', ar: 'الصواري — تحقق Yandex', en: 'Al Sawarey — Yandex verification', ph: 'yandex-verification token' },
];
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function AnalyticsClient({ values, locale }: { values: Record<string, string>; locale: 'ar' | 'en' }) {
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const [v, setV] = useState<Record<string, string>>(values);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl space-y-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          {L(f.ar, f.en)}
          <input value={v[f.key] ?? ''} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} dir="ltr" placeholder={f.ph} className={inp} />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() => { setSaved(false); start(async () => { const r = await saveAnalytics(v); setSaved(r.ok); }); }}
          className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50"
        >
          {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
        </button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}
