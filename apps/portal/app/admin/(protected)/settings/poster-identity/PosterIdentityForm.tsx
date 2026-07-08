'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImageAttachment, toast, type UploadedAttachment } from '@noc/ui';
import { POSTER_FONTS } from '../../../../../lib/poster/icons';
import { savePosterTheme, type PosterThemeInput } from './actions';

type Brand = 'newobour' | 'alsawarey';
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

const COLOR_FIELDS: Array<{ key: keyof PosterThemeInput; ar: string; en: string }> = [
  { key: 'navy', ar: 'الكحلي (العناوين والأشرطة)', en: 'Navy (headers & strips)' },
  { key: 'gold', ar: 'الذهبي (الإطار والفواصل)', en: 'Gold (frame & dividers)' },
  { key: 'cream', ar: 'الخلفية', en: 'Background' },
  { key: 'tint', ar: 'صفوف الجدول', en: 'Table row tint' },
  { key: 'ink', ar: 'لون النص', en: 'Text color' },
];

export function PosterIdentityForm({
  brand,
  brandLabel,
  initial,
  defaultLogo,
  locale,
}: {
  brand: Brand;
  brandLabel: string;
  initial: PosterThemeInput;
  defaultLogo: string | null;
  locale: 'ar' | 'en';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<PosterThemeInput>(initial);
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const set = (patch: Partial<PosterThemeInput>) => setF((p) => ({ ...p, ...patch }));

  function save() {
    start(async () => {
      const r = await savePosterTheme(brand, f);
      if (r.ok) {
        toast(L('تم الحفظ — أعد توليد الصور لتطبيق الهوية الجديدة', 'Saved — regenerate images to apply the new identity'));
        router.refresh();
      } else {
        toast(r.error === 'bad_color' ? L('لون غير صالح', 'Invalid color') : L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-graphite/15 p-5">
      <h2 className="text-lg font-bold text-primary">{brandLabel}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_FIELDS.map((c) => (
          <label key={c.key} className="text-sm">
            {L(c.ar, c.en)}
            <span className="mt-1 flex items-center gap-2">
              <input type="color" value={f[c.key] as string} onChange={(e) => set({ [c.key]: e.target.value } as Partial<PosterThemeInput>)} className="h-9 w-12 cursor-pointer rounded border border-graphite/20 bg-transparent" />
              <input dir="ltr" value={f[c.key] as string} onChange={(e) => set({ [c.key]: e.target.value } as Partial<PosterThemeInput>)} className={inp} />
            </span>
          </label>
        ))}
        <label className="text-sm">
          {L('الخط', 'Font')}
          <select value={f.font} onChange={(e) => set({ font: e.target.value })} className={`${inp} mt-1`}>
            {POSTER_FONTS.map((x) => (<option key={x} value={x}>{x}</option>))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-sm">
          <span className="mb-1 block">{L('الشعار (اختياري — الافتراضي شعار الموقع)', 'Logo (optional — defaults to the site logo)')}</span>
          <ImageAttachment
            value={f.logoPath ? { id: '', path: f.logoPath, originalName: '' } : defaultLogo ? { id: '', path: defaultLogo, originalName: '' } : null}
            onChange={(a: UploadedAttachment | null) => set({ logoPath: a?.path ?? '' })}
          />
        </div>
        <label className="text-sm">
          {L('رقم الهاتف (اختياري)', 'Phone (optional)')}
          <input dir="ltr" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder={L('الافتراضي من الإعدادات', 'Default from settings')} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm">
          {L('النطاق (اختياري)', 'Domain (optional)')}
          <input dir="ltr" value={f.domain} onChange={(e) => set({ domain: e.target.value })} placeholder={brand === 'alsawarey' ? 'alsawarey.com' : 'newobour.com'} className={`${inp} mt-1`} />
        </label>
      </div>

      <button onClick={save} disabled={pending} className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-soft disabled:opacity-50">
        {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الهوية', 'Save identity')}
      </button>
    </section>
  );
}
