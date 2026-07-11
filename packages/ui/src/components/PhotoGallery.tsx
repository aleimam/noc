'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

export function PhotoGallery({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  if (!photos.length) return <div className="h-56 w-full rounded-lg bg-graphite/10" />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <button key={i} type="button" onClick={() => setIdx(i)} aria-label={`photo ${i + 1}`} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p}
              alt=""
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
