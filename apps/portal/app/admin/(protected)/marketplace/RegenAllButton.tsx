'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { regenerateAllListingImages } from './actions';

type TypeOpt = { id: string; nameAr: string; nameEn: string };

/** Bulk image regeneration for published listings — everything, or one Type category. */
export function RegenAllButton({ locale, types = [] }: { locale: 'ar' | 'en'; types?: TypeOpt[] }) {
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState('');
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  function run() {
    const scope = typeId
      ? L('إعادة توليد صور إعلانات هذه الفئة المنشورة؟', 'Regenerate images for this category’s published listings?')
      : L('إعادة توليد صور كل الإعلانات المنشورة؟ قد يستغرق بعض الوقت.', 'Regenerate images for all published listings? This may take a while.');
    if (!window.confirm(scope)) return;
    start(async () => {
      const r = await regenerateAllListingImages(typeId || undefined);
      if (r.ok) toast(L(`تم توليد صور ${r.count} إعلان`, `Generated images for ${r.count} listings`));
      else toast(L('تعذّر التوليد', 'Failed'), 'error');
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm">
        <option value="">{L('كل الفئات', 'All categories')}</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{L(t.nameAr, t.nameEn)}</option>
        ))}
      </select>
      <button type="button" onClick={run} disabled={pending} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10 disabled:opacity-50">
        {pending
          ? L('جارٍ التوليد…', 'Generating…')
          : typeId
            ? L('🖼 إعادة توليد صور الفئة', '🖼 Regenerate category images')
            : L('🖼 إعادة توليد كل صور الإعلانات', '🖼 Regenerate all listing images')}
      </button>
    </div>
  );
}
