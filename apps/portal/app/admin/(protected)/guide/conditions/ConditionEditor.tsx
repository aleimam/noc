'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RichEditor } from '../../pages/RichEditor';
import { ConditionImages } from './ConditionImages';
import { saveBuildingCondition } from './actions';

type Draft = {
  id?: string;
  slug: string;
  unitLabelAr: string;
  unitLabelEn: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  images: string[];
  order: number;
  published: boolean;
};

const inp = 'w-full rounded border border-graphite/20 bg-transparent px-3 py-2 text-sm';

export function ConditionEditor({ initial }: { initial: Draft }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  function save() {
    if (!d.unitLabelAr.trim() || !d.titleAr.trim()) { setError('أدخل الوحدة والعنوان'); return; }
    setError('');
    start(async () => {
      const r = await saveBuildingCondition(d);
      if (r.ok) router.push('/admin/guide/conditions');
      else setError(r.error === 'duplicate_slug' ? 'الرابط مستخدم بالفعل' : 'تعذّر الحفظ');
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">الوحدة (عربي) — مثال: أرض 300م<input value={d.unitLabelAr} onChange={(e) => set('unitLabelAr', e.target.value)} className={inp} /></label>
        <label className="text-sm">الوحدة (إنجليزي)<input value={d.unitLabelEn} onChange={(e) => set('unitLabelEn', e.target.value)} dir="ltr" className={inp} /></label>
        <label className="text-sm">العنوان (عربي)<input value={d.titleAr} onChange={(e) => set('titleAr', e.target.value)} className={inp} /></label>
        <label className="text-sm">العنوان (إنجليزي)<input value={d.titleEn} onChange={(e) => set('titleEn', e.target.value)} dir="ltr" className={inp} /></label>
        <label className="text-sm">الرابط (slug)<input value={d.slug} onChange={(e) => set('slug', e.target.value)} dir="ltr" placeholder="land-300" className={inp} /></label>
        <label className="text-sm">الترتيب<input type="number" value={d.order} onChange={(e) => set('order', parseInt(e.target.value, 10) || 0)} className={inp} /></label>
        <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={d.published} onChange={(e) => set('published', e.target.checked)} /> منشور (ظاهر في الموقع)</label>
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">المحتوى (عربي) — يدعم الجداول والصور</div>
        <RichEditor value={d.bodyAr} onChange={(html) => set('bodyAr', html)} dir="rtl" />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">المحتوى (إنجليزي)</div>
        <RichEditor value={d.bodyEn} onChange={(html) => set('bodyEn', html)} dir="ltr" />
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">الصور (تظهر أسفل الصفحة، قابلة للتكبير)</div>
        <ConditionImages value={d.images} onChange={(v) => set('images', v)} />
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        <a href="/admin/guide/conditions" className="px-3 py-2 text-sm opacity-70">إلغاء</a>
      </div>
    </div>
  );
}
