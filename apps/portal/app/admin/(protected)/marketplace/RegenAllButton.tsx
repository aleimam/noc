'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { regenerateAllListingImages } from './actions';

export function RegenAllButton({ locale }: { locale: 'ar' | 'en' }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  function run() {
    if (!window.confirm(L('إعادة توليد صور كل الإعلانات المنشورة؟ قد يستغرق بعض الوقت.', 'Regenerate images for all published listings? This may take a while.'))) return;
    start(async () => {
      const r = await regenerateAllListingImages();
      if (r.ok) toast(L(`تم توليد صور ${r.count} إعلان`, `Generated images for ${r.count} listings`));
      else toast(L('تعذّر التوليد', 'Failed'), 'error');
      router.refresh();
    });
  }
  return (
    <button type="button" onClick={run} disabled={pending} className="rounded-md border border-graphite/25 px-3 py-1.5 text-sm hover:bg-graphite/10 disabled:opacity-50">
      {pending ? L('جارٍ التوليد…', 'Generating…') : L('🖼 إعادة توليد كل صور الإعلانات', '🖼 Regenerate all listing images')}
    </button>
  );
}
