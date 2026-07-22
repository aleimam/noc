'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { RichEditor } from './RichEditor';
import { savePage } from './actions';

type Draft = {
  id?: string;
  brand: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  published: boolean;
  footerOrder: number;
};

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function PageEditor({ initial }: { initial: Draft }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [d, setD] = useState<Draft>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  function save() {
    if (!d.titleAr.trim()) { setError(L('أدخل العنوان', 'Enter the title')); return; }
    setError('');
    start(async () => {
      const r = await savePage(d);
      if (r.ok) router.push('/admin/pages');
      else setError(r.error === 'duplicate_slug' ? L('الرابط مستخدم بالفعل', 'That link is already in use') : L('تعذّر الحفظ', 'Save failed'));
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{L('الموقع', 'Site')}
          <select value={d.brand} onChange={(e) => set('brand', e.target.value)} className={inp} disabled={!!d.id}>
            <option value="newobour">{L('العبور الجديدة', 'New Obour')}</option>
            <option value="alsawarey">{L('الصواري', 'Al Sawarey')}</option>
          </select>
        </label>
        <label className="text-sm">{L('الرابط (slug)', 'Link (slug)')}<input value={d.slug} onChange={(e) => set('slug', e.target.value)} dir="ltr" placeholder="about" className={inp} /></label>
        <label className="text-sm">{L('العنوان (عربي)', 'Title (Arabic)')}<input value={d.titleAr} onChange={(e) => set('titleAr', e.target.value)} className={inp} /></label>
        <label className="text-sm">{L('العنوان (إنجليزي)', 'Title (English)')}<input value={d.titleEn} onChange={(e) => set('titleEn', e.target.value)} dir="ltr" className={inp} /></label>
        <label className="text-sm">{L('ترتيب الفوتر', 'Footer order')}<input type="number" value={d.footerOrder} onChange={(e) => set('footerOrder', parseInt(e.target.value, 10) || 0)} className={inp} /></label>
        <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={d.published} onChange={(e) => set('published', e.target.checked)} /> {L('منشور (ظاهر في الموقع)', 'Published (visible on the site)')}</label>
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">{L('المحتوى (عربي)', 'Content (Arabic)')}</div>
        <RichEditor value={d.bodyAr} onChange={(html) => set('bodyAr', html)} dir="rtl" />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">{L('المحتوى (إنجليزي)', 'Content (English)')}</div>
        <RichEditor value={d.bodyEn} onChange={(html) => set('bodyEn', html)} dir="ltr" />
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
        <a href="/admin/pages" className="px-3 py-2 text-sm opacity-70">{L('إلغاء', 'Cancel')}</a>
      </div>
    </div>
  );
}
