'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from './Toast';

type Props = {
  /** Single image (back-compat). */
  src?: string;
  /** Multiple images with prev/next navigation. */
  photos?: string[];
  index?: number;
  alt?: string;
  /** UI-label language (Arabic-first default). */
  locale?: 'ar' | 'en';
  /** Keeps the caller's gallery in sync while the visitor browses in here. */
  onIndexChange?: (i: number) => void;
  /** "Ask about THIS photo" — a WhatsApp button that opens a chat with `text` + the image URL.
   *  `phone` must already be in international wa.me form (e.g. 2010…). */
  whatsapp?: { phone: string; text: string };
  /** Analytics hook: fired on user actions ('nav' | 'zoom' | 'copy' | 'share' | 'download' | 'open_tab' | 'whatsapp'). */
  onEvent?: (name: string, index: number) => void;
  onClose: () => void;
};

/** Fullscreen image viewer: zoomable (wheel / double-tap / +− buttons, drag to pan)
 *  and, when given `photos`, swipeable between images. Closes on ESC or backdrop click. */
export function Lightbox({ src, photos, index = 0, alt, locale = 'ar', onIndexChange, whatsapp, onEvent, onClose }: Props) {
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
  const zoomFired = useRef(false); // report zoom once per image, not per wheel-tick
  const go = useCallback(
    (d: number) => {
      if (!many) return;
      setI((v) => {
        const next = (v + d + list.length) % list.length;
        onIndexChange?.(next);
        onEvent?.('nav', next);
        return next;
      });
      zoomFired.current = false;
      reset();
    },
    [many, list.length, reset, onIndexChange, onEvent],
  );
  const reportZoom = () => {
    if (zoomFired.current) return;
    zoomFired.current = true;
    onEvent?.('zoom', i);
  };

  // ── Actions on the current image (ecommerce lightbox): copy / share / download / open ──
  const absUrl = () => new URL(cur!, window.location.href).href;
  const copyLink = async () => {
    await navigator.clipboard.writeText(absUrl());
    toast(L('تم نسخ رابط الصورة', 'Image link copied'));
  };
  const copyImage = async () => {
    onEvent?.('copy', i);
    try {
      // Clipboard accepts PNG only → recompress through a canvas when needed (same-origin, untainted).
      if (!navigator.clipboard || !('write' in navigator.clipboard) || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      const blob = await (await fetch(cur!)).blob();
      let png = blob;
      if (blob.type !== 'image/png') {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d')!.drawImage(bmp, 0, 0);
        png = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast(L('تم نسخ الصورة', 'Image copied'));
    } catch {
      try { await copyLink(); } catch { /* clipboard unavailable */ }
    }
  };
  const share = async () => {
    onEvent?.('share', i);
    const url = absUrl();
    if (navigator.share) {
      try { await navigator.share({ url, title: alt || undefined }); } catch { /* visitor cancelled */ }
      return;
    }
    try { await copyLink(); } catch { /* clipboard unavailable */ }
  };
  const download = () => {
    onEvent?.('download', i);
    const a = document.createElement('a');
    a.href = cur!;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const openTab = () => {
    onEvent?.('open_tab', i);
    window.open(absUrl(), '_blank', 'noopener');
  };
  const askWhatsapp = () => {
    if (!whatsapp) return;
    onEvent?.('whatsapp', i);
    window.open(`https://wa.me/${whatsapp.phone}?text=${encodeURIComponent(`${whatsapp.text}\n${absUrl()}`)}`, '_blank', 'noopener');
  };

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

  const zoomBy = (d: number) => {
    if (d > 0) reportZoom();
    setScale((s) => Math.min(4, Math.max(1, +(s + d).toFixed(2))));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.3 : -0.3);
  };
  const onDblClick = () => {
    if (scale > 1) return reset();
    reportZoom();
    setScale(2.4);
  };
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

      {/* actions + prev / next + counter */}
      <div className="fixed inset-x-0 bottom-4 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {whatsapp && (
            <button type="button" onClick={askWhatsapp} className="rounded-full bg-[#25D366] px-4 py-1.5 text-sm font-bold text-white hover:brightness-110">
              🟢 {L('اسأل عن هذه الصورة', 'Ask about this photo')}
            </button>
          )}
          <button type="button" onClick={copyImage} className="rounded-full bg-soft/20 px-3 py-1.5 text-sm text-soft hover:bg-soft/30">📋 {L('نسخ', 'Copy')}</button>
          <button type="button" onClick={share} className="rounded-full bg-soft/20 px-3 py-1.5 text-sm text-soft hover:bg-soft/30">📤 {L('مشاركة', 'Share')}</button>
          <button type="button" onClick={download} className="rounded-full bg-soft/20 px-3 py-1.5 text-sm text-soft hover:bg-soft/30">⬇️ {L('تنزيل', 'Download')}</button>
          <button type="button" onClick={openTab} className="rounded-full bg-soft/20 px-3 py-1.5 text-sm text-soft hover:bg-soft/30">🔗 {L('فتح في صفحة', 'Open in tab')}</button>
        </div>
        {many && (
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => go(1)} className="rounded-full bg-soft/20 px-4 py-1.5 text-sm text-soft hover:bg-soft/30">{L('التالي', 'Next')}</button>
            <span className="rounded-full bg-soft/15 px-3 py-1 text-sm text-soft" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1} / {list.length}</span>
            <button type="button" onClick={() => go(-1)} className="rounded-full bg-soft/20 px-4 py-1.5 text-sm text-soft hover:bg-soft/30">{L('السابق', 'Previous')}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
