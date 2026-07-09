'use client';

import { useState } from 'react';
import { Lightbox } from '@noc/ui';

/** Listing hero: one large image + a horizontal, scrollable thumbnail strip (all photos
 *  reachable in-page). Tap the main image (or ⛶) to open the zoomable fullscreen viewer. */
export function HeroGallery({ photos, alt }: { photos: string[]; alt?: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  if (!photos.length) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-navy-100 text-4xl text-navy-300" aria-hidden>🏞</div>;
  }
  const cur = photos[Math.min(i, photos.length - 1)]!;
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-graphite/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur}
          alt={alt ?? ''}
          onClick={() => setOpen(true)}
          loading="eager"
          fetchPriority="high"
          className="aspect-[4/3] w-full cursor-zoom-in bg-navy-100 object-cover"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="تكبير الصورة"
          className="absolute start-3 top-3 rounded-xl bg-navy/60 px-3 py-1.5 text-lg leading-none text-white hover:bg-navy/75"
        >
          ⛶
        </button>
        {photos.length > 1 && (
          <span className="absolute bottom-3 end-3 rounded-full bg-navy/60 px-3 py-1 text-xs text-white" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {i + 1} / {photos.length}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              aria-label={`صورة ${k + 1}`}
              className={`h-16 w-20 flex-none overflow-hidden rounded-lg ring-2 transition ${k === i ? 'ring-gold-600' : 'ring-transparent hover:ring-graphite/25'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && <Lightbox photos={photos} index={i} onClose={() => setOpen(false)} />}
    </div>
  );
}
