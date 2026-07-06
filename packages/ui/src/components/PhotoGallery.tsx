'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

export function PhotoGallery({ photos }: { photos: string[] }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (!photos.length) return <div className="h-56 w-full rounded-lg bg-graphite/10" />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p}
            alt=""
            onClick={() => setZoom(p)}
            // First image is likely the LCP element → load it eagerly with high priority;
            // defer the rest to cut initial payload (Core Web Vitals).
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
            className="h-32 w-full cursor-pointer rounded-lg object-cover ring-1 ring-graphite/15"
          />
        ))}
      </div>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
