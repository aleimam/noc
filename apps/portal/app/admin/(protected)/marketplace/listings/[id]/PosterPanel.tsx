'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { generateListingPosters } from './poster-actions';

const BRAND_LABEL: Record<string, { ar: string; en: string }> = {
  newobour: { ar: 'العبور الجديد', en: 'New Obour' },
  alsawarey: { ar: 'الصواري', en: 'Al Sawarey' },
  unbranded: { ar: 'بدون علامة (للشركاء)', en: 'Unbranded (partners)' },
};

export function PosterPanel({ listingId, posters, locale }: { listingId: string; posters: { brand: string; path: string }[]; locale: 'ar' | 'en' }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  function gen() {
    start(async () => {
      const r = await generateListingPosters(listingId);
      if (r.ok) { toast(L('تم توليد الملصقات', 'Posters generated')); router.refresh(); }
      else toast(L('تعذّر التوليد', 'Generation failed'), 'error');
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={gen}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50"
        >
          {pending ? L('جارٍ التوليد…', 'Generating…') : posters.length ? L('إعادة توليد الملصقات', 'Regenerate posters') : L('توليد الملصقات', 'Generate posters')}
        </button>
        <span className="text-xs opacity-60">{L('يُنشئ ملصق العرض بثلاث نسخ: العبور الجديد، الصواري، وبدون علامة.', 'Creates the poster in 3 versions: New Obour, Al Sawarey, and unbranded.')}</span>
      </div>
      {posters.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {posters.map((p) => (
            <figure key={p.brand} className="space-y-1 rounded-lg border border-graphite/15 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt={p.brand} className="w-full rounded ring-1 ring-graphite/15" />
              <figcaption className="flex items-center justify-between text-xs">
                <span className="font-semibold">{L(BRAND_LABEL[p.brand]?.ar ?? p.brand, BRAND_LABEL[p.brand]?.en ?? p.brand)}</span>
                <a href={p.path} download className="text-accent">{L('تنزيل', 'Download')}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
