'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ImageAttachment, toast, type UploadedAttachment } from '@noc/ui';
import { saveBrandAsset } from './actions';

type Field = { key: string; label: readonly [string, string] };
const BRANDS: { title: readonly [string, string]; fields: Field[] }[] = [
  {
    title: ['العبور الجديدة (newobour.com)', 'New Obour (newobour.com)'],
    fields: [
      { key: 'brand_newobour_logo', label: ['الشعار', 'Logo'] },
      { key: 'brand_newobour_logo_dark', label: ['الشعار (الوضع الداكن)', 'Logo (dark mode)'] },
      { key: 'brand_newobour_favicon', label: ['أيقونة الموقع (favicon)', 'Site icon (favicon)'] },
    ],
  },
  {
    title: ['الصواري (alsawarey.com)', 'Al Sawarey (alsawarey.com)'],
    fields: [
      { key: 'brand_alsawarey_logo', label: ['الشعار', 'Logo'] },
      { key: 'brand_alsawarey_logo_dark', label: ['الشعار (الوضع الداكن)', 'Logo (dark mode)'] },
      { key: 'brand_alsawarey_favicon', label: ['أيقونة الموقع (favicon)', 'Site icon (favicon)'] },
      { key: 'brand_alsawarey_hero', label: ['صورة الواجهة (الهيرو في الصفحة الرئيسية)', 'Hero image (home page)'] },
    ],
  },
];

export function BrandingClient({ values }: { values: Record<string, string> }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [state, setState] = useState<Record<string, string | null>>(values);

  async function onChange(key: string, att: UploadedAttachment | null) {
    const prev = state[key] ?? null;
    const path = att?.path ?? null;
    setState((s) => ({ ...s, [key]: path }));
    try {
      const r = await saveBrandAsset(key, path);
      if (!r.ok) throw new Error(r.error);
    } catch {
      setState((s) => ({ ...s, [key]: prev }));
      toast(L('تعذّر الحفظ', 'Save failed'), 'error');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {BRANDS.map((b) => (
        <section key={b.title[0]} className="space-y-4 rounded-lg border border-graphite/15 p-4">
          <h2 className="font-semibold text-primary">{L(...b.title)}</h2>
          {b.fields.map((f) => (
            <div key={f.key}>
              <div className="mb-1 text-sm">{L(...f.label)}</div>
              <ImageAttachment
                value={state[f.key] ? { id: '', path: state[f.key] as string, originalName: '' } : null}
                onChange={(att) => onChange(f.key, att)}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
