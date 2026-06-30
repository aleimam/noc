'use client';

import { useState, useTransition } from 'react';
import { saveAnalytics } from './actions';

const FIELDS: { key: string; label: string; ph: string }[] = [
  { key: 'ga4_newobour', label: 'العبور الجديد — GA4 Measurement ID', ph: 'G-XXXXXXXXXX' },
  { key: 'pixel_newobour', label: 'العبور الجديد — Meta Pixel ID', ph: '1234567890' },
  { key: 'gsc_newobour', label: 'العبور الجديد — Google verification', ph: 'google-site-verification token' },
  { key: 'ga4_alsawarey', label: 'الصواري — GA4 Measurement ID', ph: 'G-XXXXXXXXXX' },
  { key: 'pixel_alsawarey', label: 'الصواري — Meta Pixel ID', ph: '1234567890' },
  { key: 'gsc_alsawarey', label: 'الصواري — Google verification', ph: 'google-site-verification token' },
];
const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function AnalyticsClient({ values }: { values: Record<string, string> }) {
  const [v, setV] = useState<Record<string, string>>(values);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl space-y-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          {f.label}
          <input value={v[f.key] ?? ''} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} dir="ltr" placeholder={f.ph} className={inp} />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() => { setSaved(false); start(async () => { const r = await saveAnalytics(v); setSaved(r.ok); }); }}
          className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50"
        >
          {pending ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
