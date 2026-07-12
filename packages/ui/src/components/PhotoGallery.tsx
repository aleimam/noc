'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

export function PhotoGallery({ photos, alt, locale = 'ar' }: { photos: string[]; alt?: string; locale?: 'ar' | 'en' }) {
  const [idx, setIdx] = useState<number | null>(null);
  if (!photos.length) return <div className="h-56 w-full rounded-lg bg-graphite/10" />;
  // Descriptive alt from the caller (image SEO): index-suffixed when there's more than one
  // photo so each carries a distinct, meaningful description. Empty falls back to decorative.
  const altFor = (i: number) =>
    alt ? (photos.length > 1 ? `${alt} — ${locale === 'ar' ? 'صورة' : 'photo'} ${i + 1}` : alt) : '';
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <button key={i} type="button" onClick={() => setIdx(i)} aria-label={altFor(i) || `photo ${i + 1}`} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p}
              alt={altFor(i)}
              // First image is likely the LCP element → load it eagerly with high priority;
              // defer the rest to cut initial payload (Core Web Vitals).
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              className="h-32 w-full cursor-pointer rounded-lg object-cover ring-1 ring-graphite/15"
            />
          </button>
        ))}
      </div>
      {idx !== null && <Lightbox photos={photos} index={idx} onClose={() => setIdx(null)} />}
    </div>
  );
}
