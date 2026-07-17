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
        <label className="text-sm">
          {L('تخطيط رأس البوستر', 'Poster header layout')}
          <select value={f.headerLayout} onChange={(e) => set({ headerLayout: e.target.value })} className={`${inp} mt-1`}>
            <option value="side">{L('مضغوط — جدول البيانات بجوار العنوان', 'Compact — info table beside the title')}</option>
            <option value="row">{L('صف كامل — جدول البيانات أسفل العنوان', 'Full row — info table below the title')}</option>
          </select>
          <span className="mt-1 block text-xs opacity-60">
            {L('«صف كامل» يمنح العنوان عرض البوستر كاملًا (أفضل للعناوين الطويلة)', '“Full row” gives the title the whole width (better for long titles)')}
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-sm">
          <span className="mb-1 block">{L('شعار الختم (دائري — أسفل الكارت)', 'Seal logo (round — card footer)')}</span>
          <ImageAttachment
            value={f.logoPath ? { id: '', path: f.logoPath, originalName: '' } : defaultLogo ? { id: '', path: defaultLogo, originalName: '' } : null}
            onChange={(a: UploadedAttachment | null) => set({ logoPath: a?.path ?? '' })}
          />
        </div>
        <div className="text-sm">
          <span className="mb-1 block">{L('شعار رأس البوستر (أفقي)', 'Poster header logo (horizontal)')}</span>
          <ImageAttachment
            value={f.headerLogo ? { id: '', path: f.headerLogo, originalName: '' } : null}
            onChange={(a: UploadedAttachment | null) => set({ headerLogo: a?.path ?? '' })}
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
