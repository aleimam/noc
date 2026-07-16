'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbox } from './Lightbox';

export type GalleryItem = { src: string; label?: string };

/** Ecommerce-style listing gallery: one large hero image with prev/next arrows, swipe,
 *  a label chip (photo / poster / map), a counter, and a thumbnail strip. Tapping the hero
 *  opens the fullscreen Lightbox (zoom / copy / share / download / open-in-tab).
 *  Auto-advances every `autoPlayMs` until the visitor interacts (then stops for good). */
export function HeroGallery({
  items,
  photos,
  alt,
  locale = 'ar',
  autoPlayMs = 4000,
}: {
  items?: GalleryItem[];
  /** Back-compat: plain paths (no labels). */
  photos?: string[];
  alt?: string;
  locale?: 'ar' | 'en';
  /** 0 disables auto-advance. */
  autoPlayMs?: number;
}) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const list: GalleryItem[] = items ?? (photos ?? []).map((src) => ({ src }));
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const stopped = useRef(false); // any interaction permanently stops autoplay for this visit
  const visible = useRef(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const n = list.length;
  const cur = list[Math.min(i, n - 1)];

  const stop = useCallback(() => {
    stopped.current = true;
  }, []);
  const go = useCallback(
    (d: number) => {
      if (n < 2) return;
      setI((v) => (v + d + n) % n);
    },
    [n],
  );
  // Physical arrows: each moves the image strip in its own visual direction.
  // RTL reads right→left, so the visually-left arrow advances (matches Lightbox keys).
  const goLeft = () => { stop(); go(locale === 'ar' ? 1 : -1); };
  const goRight = () => { stop(); go(locale === 'ar' ? -1 : 1); };

  // Auto-advance: skipped for reduced-motion, hidden tabs, off-screen galleries,
  // an open lightbox, or once the visitor has interacted.
  useEffect(() => {
    if (!autoPlayMs || n < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = rootRef.current;
    const io = el && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => { visible.current = !!es[0]?.isIntersecting; }, { threshold: 0.3 })
      : null;
    if (io && el) io.observe(el);
    const t = setInterval(() => {
      if (stopped.current || open || document.hidden || !visible.current) return;
      setI((v) => (v + 1) % n);
    }, autoPlayMs);
    return () => { clearInterval(t); io?.disconnect(); };
  }, [autoPlayMs, n, open]);

  // Keep the active thumbnail in view + preload the neighbours for instant arrows.
  useEffect(() => {
    const strip = thumbsRef.current;
    const active = strip?.children[i] as HTMLElement | undefined;
    if (strip && active) {
      const target = active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2;
      strip.scrollTo({ left: target, behavior: 'smooth' });
    }
    if (n > 1 && typeof window !== 'undefined') {
      for (const d of [1, -1]) {
        const img = new window.Image();
        img.src = list[(i + d + n) % n]!.src;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

  if (!n) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-graphite/10 text-4xl opacity-40" aria-hidden>🏞</div>;
  }

  const altFor = (k: number) => {
    const label = list[k]?.label;
    const base = alt ? (label ? `${alt} — ${label}` : alt) : label ?? '';
    return base ? (n > 1 ? `${base} — ${k + 1}` : base) : '';
  };

  const onPointerDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || n < 2) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      stop();
      // Swiping drags the strip: swipe left = reveal what's after in LTR / before in RTL.
      go(locale === 'ar' ? (dx > 0 ? 1 : -1) : dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      stop();
      setOpen(true); // treat as a tap
    }
  };

  const arrowCls =
    'absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-navy/55 text-2xl leading-none text-white shadow-md hover:bg-navy/75';

  return (
    <div ref={rootRef}>
      <div className="relative overflow-hidden rounded-2xl bg-graphite/5 ring-1 ring-graphite/15" dir="ltr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur!.src}
          alt={altFor(i)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          draggable={false}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={{ touchAction: 'pan-y' }}
          className="aspect-[4/3] w-full cursor-zoom-in select-none object-contain"
        />
        {cur!.label && (
          <span dir={locale === 'ar' ? 'rtl' : 'ltr'} className="absolute top-3 rounded-full bg-navy/60 px-3 py-1 text-xs font-semibold text-white" style={{ [locale === 'ar' ? 'right' : 'left']: '0.75rem' } as React.CSSProperties}>
            {cur!.label}
          </span>
        )}
        <button
          type="button"
          onClick={() => { stop(); setOpen(true); }}
          aria-label={L('تكبير الصورة', 'Zoom image')}
          className="absolute bottom-3 rounded-xl bg-navy/60 px-3 py-1.5 text-lg leading-none text-white hover:bg-navy/75"
          style={{ [locale === 'ar' ? 'right' : 'left']: '0.75rem' } as React.CSSProperties}
        >
          ⛶
        </button>
        {n > 1 && (
          <>
            <button type="button" onClick={goLeft} aria-label={locale === 'ar' ? 'التالي' : 'Previous'} className={`${arrowCls} left-2`}>‹</button>
            <button type="button" onClick={goRight} aria-label={locale === 'ar' ? 'السابق' : 'Next'} className={`${arrowCls} right-2`}>›</button>
            <span
              className="absolute bottom-3 rounded-full bg-navy/60 px-3 py-1 text-xs text-white"
              style={{ [locale === 'ar' ? 'left' : 'right']: '0.75rem', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}
            >
              {i + 1} / {n}
            </span>
          </>
        )}
      </div>

      {n > 1 && (
        <div ref={thumbsRef} className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {list.map((p, k) => (
            <button
              key={k}
              type="button"
              onClick={() => { stop(); setI(k); }}
              aria-label={altFor(k) || L(`صورة ${k + 1}`, `Photo ${k + 1}`)}
              aria-current={k === i}
              className={`relative h-16 w-20 flex-none overflow-hidden rounded-lg ring-2 transition ${k === i ? 'ring-accent' : 'ring-transparent hover:ring-graphite/25'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={altFor(k)} loading="lazy" decoding="async" className="h-full w-full bg-graphite/5 object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <Lightbox
          photos={list.map((p) => p.src)}
          index={i}
          alt={alt}
          locale={locale}
          onIndexChange={setI}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
