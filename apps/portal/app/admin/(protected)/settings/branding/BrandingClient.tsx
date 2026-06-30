'use client';

import { useState } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveBrandAsset } from './actions';

type Field = { key: string; label: string };
const BRANDS: { title: string; fields: Field[] }[] = [
  {
    title: 'العبور الجديد (newobour.com)',
    fields: [
      { key: 'brand_newobour_logo', label: 'الشعار' },
      { key: 'brand_newobour_logo_dark', label: 'الشعار (الوضع الداكن)' },
      { key: 'brand_newobour_favicon', label: 'أيقونة الموقع (favicon)' },
    ],
  },
  {
    title: 'الصواري (alsawarey.com)',
    fields: [
      { key: 'brand_alsawarey_logo', label: 'الشعار' },
      { key: 'brand_alsawarey_logo_dark', label: 'الشعار (الوضع الداكن)' },
      { key: 'brand_alsawarey_favicon', label: 'أيقونة الموقع (favicon)' },
      { key: 'brand_alsawarey_hero', label: 'صورة الواجهة (الهيرو في الصفحة الرئيسية)' },
    ],
  },
];

export function BrandingClient({ values }: { values: Record<string, string> }) {
  const [state, setState] = useState<Record<string, string | null>>(values);

  function onChange(key: string, att: UploadedAttachment | null) {
    const path = att?.path ?? null;
    setState((s) => ({ ...s, [key]: path }));
    void saveBrandAsset(key, path);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {BRANDS.map((b) => (
        <section key={b.title} className="space-y-4 rounded-lg border border-graphite/15 p-4">
          <h2 className="font-semibold text-primary">{b.title}</h2>
          {b.fields.map((f) => (
            <div key={f.key}>
              <div className="mb-1 text-sm">{f.label}</div>
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
