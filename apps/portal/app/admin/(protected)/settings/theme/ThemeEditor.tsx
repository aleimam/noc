'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from '@noc/ui';
import { THEME_FONTS, type BrandTheme } from '@noc/config';
import { saveBrandTheme, resetBrandTheme } from './actions';

// Compiled defaults (from theme.css) — shown as the starting point for the pickers.
const DEFAULTS = { navy: '#0b1b33', gold: '#c9983e', bg: '#f7f7f5', fg: '#2d2d2d' };

type Brand = 'newobour' | 'alsawarey';
const inp = 'rounded-md border border-graphite/20 bg-transparent px-2 py-1 text-sm';

function ColorField({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (v: string) => void }) {
  const v = value || fallback;
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : fallback} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-graphite/20" />
        <input dir="ltr" value={value} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className={`${inp} w-24 font-mono`} />
      </span>
    </label>
  );
}

export function ThemeEditor({ brand, title, initial }: { brand: Brand; title: string; initial: BrandTheme | null }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [pending, start] = useTransition();
  const [t, setT] = useState<BrandTheme>(initial ?? {});
  const [saved, setSaved] = useState(false);
  const set = (k: keyof BrandTheme) => (v: string) => { setSaved(false); setT((s) => ({ ...s, [k]: v }) as BrandTheme); };

  function save() {
    start(async () => {
      const r = await saveBrandTheme(brand, t);
      if (r.ok) { setSaved(true); router.refresh(); }
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }
  function reset() {
    if (!confirm(L('إعادة التعيين للوضع الافتراضي؟', 'Reset to defaults?'))) return;
    start(async () => {
      const r = await resetBrandTheme(brand);
      if (r.ok) { setT({}); setSaved(true); router.refresh(); }
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-semibold text-primary">{title}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label={L('اللون الأساسي (Navy)', 'Primary colour (Navy)')} value={t.navy ?? ''} fallback={DEFAULTS.navy} onChange={set('navy')} />
        <ColorField label={L('لون التمييز (Gold)', 'Accent colour (Gold)')} value={t.gold ?? ''} fallback={DEFAULTS.gold} onChange={set('gold')} />
        <ColorField label={L('الخلفية', 'Background')} value={t.bg ?? ''} fallback={DEFAULTS.bg} onChange={set('bg')} />
        <ColorField label={L('النص', 'Text')} value={t.fg ?? ''} fallback={DEFAULTS.fg} onChange={set('fg')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">{L('الخط', 'Font')}
          <select value={t.font ?? ''} onChange={(e) => set('font')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">{L('— (افتراضي)', '— (default)')}</option>
            {THEME_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-sm">{L('الحواف', 'Corners')}
          <select value={t.radius ?? ''} onChange={(e) => set('radius')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">{L('— (افتراضي)', '— (default)')}</option>
            <option value="sharp">{L('حادّة', 'Sharp')}</option>
            <option value="soft">{L('ناعمة', 'Soft')}</option>
            <option value="round">{L('دائرية', 'Round')}</option>
          </select>
        </label>
        <label className="text-sm">{L('الكثافة', 'Density')}
          <select value={t.density ?? ''} onChange={(e) => set('density')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">{L('— (افتراضي)', '— (default)')}</option>
            <option value="compact">{L('مضغوطة', 'Compact')}</option>
            <option value="normal">{L('عادية', 'Normal')}</option>
            <option value="airy">{L('واسعة', 'Airy')}</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{L('حفظ', 'Save')}</button>
        <button disabled={pending} onClick={reset} className="rounded-md border border-graphite/25 px-4 py-2 text-sm">{L('إعادة التعيين', 'Reset')}</button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}
