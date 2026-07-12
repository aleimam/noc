'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import { generateListingPosters, type GenImage } from './poster-actions';

const BRAND_LABEL: Record<string, { ar: string; en: string }> = {
  newobour: { ar: 'العبور الجديدة', en: 'New Obour' },
  alsawarey: { ar: 'الصواري', en: 'Al Sawarey' },
  unbranded: { ar: 'بدون علامة (للشركاء)', en: 'Unbranded (partners)' },
};

export function PosterPanel({ listingId, images, locale, stale }: { listingId: string; images: GenImage[]; locale: 'ar' | 'en'; stale?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  function gen() {
    start(async () => {
      const r = await generateListingPosters(listingId);
      if (r.ok) { toast(L('تم توليد الصور', 'Images generated')); router.refresh(); }
      else toast(L('تعذّر التوليد', 'Generation failed'), 'error');
    });
  }

  const grid = (list: GenImage[], titleAr: string, titleEn: string) =>
    list.length === 0 ? null : (
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-primary">{L(titleAr, titleEn)}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {list.map((p, i) => (
            <figure key={`${p.kind}-${p.brand}-${i}`} className="space-y-1 rounded-lg border border-graphite/15 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt={`${p.kind} ${p.brand}`} className="w-full rounded ring-1 ring-graphite/15" />
              <figcaption className="flex items-center justify-between text-xs">
                <span className="font-semibold">{L(BRAND_LABEL[p.brand]?.ar ?? p.brand, BRAND_LABEL[p.brand]?.en ?? p.brand)}</span>
                <a href={p.path} download className="text-accent">{L('تنزيل', 'Download')}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {stale && images.length > 0 && (
        <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {L('تغيّرت بيانات العرض أو مميزات المنطقة بعد آخر توليد — أعد توليد الصور لتحديثها.',
            'The listing data or area advantages changed since these were generated — regenerate to update them.')}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={gen} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft disabled:opacity-50">
          {pending ? L('جارٍ التوليد…', 'Generating…') : images.length ? L('إعادة توليد الصور', 'Regenerate images') : L('توليد الصور', 'Generate images')}
        </button>
        <span className="text-xs opacity-60">{L('الملصق (٣ نسخ) + بطاقة لكل مجموعة + صورة المميزات.', 'Poster (3 versions) + one card per group + the advantages photo.')}</span>
      </div>
      {grid(images.filter((i) => i.kind === 'poster'), 'الملصق الرئيسي', 'Main poster')}
      {grid(images.filter((i) => i.kind === 'card'), 'بطاقات المجموعات', 'Group cards')}
      {grid(images.filter((i) => i.kind === 'adv'), 'صورة المميزات', 'Advantages photo')}
    </div>
  );
}
