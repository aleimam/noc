'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** Single image (back-compat). */
  src?: string;
  /** Multiple images with prev/next navigation. */
  photos?: string[];
  index?: number;
  alt?: string;
  /** UI-label language (Arabic-first default). */
  locale?: 'ar' | 'en';
  onClose: () => void;
};

/** Fullscreen image viewer: zoomable (wheel / double-tap / +− buttons, drag to pan)
 *  and, when given `photos`, swipeable between images. Closes on ESC or backdrop click. */
export function Lightbox({ src, photos, index = 0, alt, locale = 'ar', onClose }: Props) {
  const list = photos && photos.length ? photos : src ? [src] : [];
  const [i, setI] = useState(index);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const many = list.length > 1;
  const cur = list[Math.min(i, list.length - 1)];
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);
  const go = useCallback(
    (d: number) => {
      if (!many) return;
      setI((v) => (v + d + list.length) % list.length);
      reset();
    },
    [many, list.length, reset],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // RTL galleries: ArrowLeft advances to the next image.
      else if (e.key === 'ArrowLeft') go(1);
      else if (e.key === 'ArrowRight') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, go]);

  const zoomBy = (d: number) => setScale((s) => Math.min(4, Math.max(1, +(s + d).toFixed(2))));

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.3 : -0.3);
  };
  const onDblClick = () => (scale > 1 ? reset() : setScale(2.4));
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (scale <= 1) {
      // Not zoomed → track a potential horizontal swipe between photos.
      swipe.current = { x: e.clientX, y: e.clientY };
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    const s = swipe.current;
    swipe.current = null;
    if (!s || !many || scale > 1) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      // LTR: swipe left → next; RTL: swipe right → next.
      const forward = locale === 'ar' ? dx > 0 : dx < 0;
      go(forward ? 1 : -1);
    }
  };
  const onPointerCancel = () => {
    drag.current = null;
    swipe.current = null;
  };

  if (!cur) return null;

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/95 p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cur}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onDoubleClick={onDblClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        draggable={false}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in', touchAction: 'none' }}
        className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl transition-transform motion-reduce:transition-none"
      />

      <button
        type="button"
        onClick={onClose}
        aria-label={L('إغلاق', 'Close')}
        className="fixed end-4 top-4 rounded-full bg-soft/20 px-3 py-1 text-lg text-soft hover:bg-soft/30"
      >
        ✕
      </button>

      {/* zoom controls */}
      <div className="fixed start-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomBy(0.4)} aria-label={L('تكبير', 'Zoom in')} className="h-9 w-9 rounded-full bg-soft/20 text-xl leading-none text-soft hover:bg-soft/30">＋</button>
        <button type="button" onClick={() => zoomBy(-0.4)} aria-label={L('تصغير', 'Zoom out')} className="h-9 w-9 rounded-full bg-soft/20 text-xl leading-none text-soft hover:bg-soft/30">－</button>
      </div>

      {/* prev / next + counter */}
      {many && (
        <div className="fixed inset-x-0 bottom-4 flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => go(1)} className="rounded-full bg-soft/20 px-4 py-1.5 text-sm text-soft hover:bg-soft/30">{L('التالي', 'Next')}</button>
          <span className="rounded-full bg-soft/15 px-3 py-1 text-sm text-soft" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1} / {list.length}</span>
          <button type="button" onClick={() => go(-1)} className="rounded-full bg-soft/20 px-4 py-1.5 text-sm text-soft hover:bg-soft/30">{L('السابق', 'Previous')}</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
