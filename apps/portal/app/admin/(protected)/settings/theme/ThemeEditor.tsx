'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { THEME_FONTS, type BrandTheme } from '@noc/config';
import { saveBrandTheme, resetBrandTheme } from './actions';

// Compiled defaults (from theme.css) — shown as the starting point for the pickers.
const DEFAULTS = { navy: '#0b1b33', gold: '#c9983e', bg: '#f7f7f5', fg: '#2d2d2d', darkBg: '#060f1e', darkFg: '#f7f7f5' };

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
  const [pending, start] = useTransition();
  const [t, setT] = useState<BrandTheme>(initial ?? {});
  const [saved, setSaved] = useState(false);
  const set = (k: keyof BrandTheme) => (v: string) => { setSaved(false); setT((s) => ({ ...s, [k]: v }) as BrandTheme); };

  function save() {
    start(async () => {
      const r = await saveBrandTheme(brand, t);
      if (r.ok) { setSaved(true); router.refresh(); }
      else toast('تعذّر الحفظ / Save failed', 'error');
    });
  }
  function reset() {
    if (!confirm('إعادة التعيين للوضع الافتراضي؟ / Reset to defaults?')) return;
    start(async () => {
      const r = await resetBrandTheme(brand);
      if (r.ok) { setT({}); setSaved(true); router.refresh(); }
      else toast('تعذّر الحفظ / Save failed', 'error');
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
      <h2 className="font-semibold text-primary">{title}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label="اللون الأساسي (Navy)" value={t.navy ?? ''} fallback={DEFAULTS.navy} onChange={set('navy')} />
        <ColorField label="لون التمييز (Gold)" value={t.gold ?? ''} fallback={DEFAULTS.gold} onChange={set('gold')} />
        <ColorField label="الخلفية / Background" value={t.bg ?? ''} fallback={DEFAULTS.bg} onChange={set('bg')} />
        <ColorField label="النص / Text" value={t.fg ?? ''} fallback={DEFAULTS.fg} onChange={set('fg')} />
        <ColorField label="خلفية الوضع الداكن" value={t.darkBg ?? ''} fallback={DEFAULTS.darkBg} onChange={set('darkBg')} />
        <ColorField label="نص الوضع الداكن" value={t.darkFg ?? ''} fallback={DEFAULTS.darkFg} onChange={set('darkFg')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">الخط / Font
          <select value={t.font ?? ''} onChange={(e) => set('font')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">— (افتراضي)</option>
            {THEME_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-sm">الحواف / Corners
          <select value={t.radius ?? ''} onChange={(e) => set('radius')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">— (افتراضي)</option>
            <option value="sharp">حادّة / Sharp</option>
            <option value="soft">ناعمة / Soft</option>
            <option value="round">دائرية / Round</option>
          </select>
        </label>
        <label className="text-sm">الكثافة / Density
          <select value={t.density ?? ''} onChange={(e) => set('density')(e.target.value)} className={`${inp} mt-1 block w-full`}>
            <option value="">— (افتراضي)</option>
            <option value="compact">مضغوطة / Compact</option>
            <option value="normal">عادية / Normal</option>
            <option value="airy">واسعة / Airy</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">حفظ / Save</button>
        <button disabled={pending} onClick={reset} className="rounded-md border border-graphite/25 px-4 py-2 text-sm">إعادة التعيين / Reset</button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}
