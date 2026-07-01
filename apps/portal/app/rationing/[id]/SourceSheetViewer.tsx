'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Watermark, WatermarkPosition } from '../../../lib/rationing/settings';

function posStyle(p: WatermarkPosition): React.CSSProperties {
  const [v, h] = p.split('-') as [string, string];
  const s: React.CSSProperties = { position: 'absolute' };
  if (v === 'top') s.top = '4%';
  else if (v === 'bottom') s.bottom = '4%';
  else s.top = '50%';
  if (h === 'left') s.left = '4%';
  else if (h === 'right') s.right = '4%';
  else s.left = '50%';
  const tx = h === 'center' ? '-50%' : '0';
  const ty = v === 'center' ? '-50%' : '0';
  s.transform = `translate(${tx}, ${ty})`;
  return s;
}

function Stamp({ wm, scale = 1 }: { wm: Watermark; scale?: number }) {
  if (!wm.enabled || !wm.logoPath) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={wm.logoPath}
      alt=""
      aria-hidden
      style={{ ...posStyle(wm.position), width: `${wm.scale * scale}%`, opacity: wm.opacity, pointerEvents: 'none' }}
    />
  );
}

export function SourceSheetViewer({ src, fileName, watermark }: { src: string; fileName: string; watermark: Watermark }) {
  const t = useTranslations('rationing');
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1); // width multiplier when not fitting
  const [fit, setFit] = useState(true); // true = whole photo fits the screen
  const [hint, setHint] = useState(false);

  // Zoom relative to the current view; leaving "fit" switches to width-based zoom (scrollable).
  function zoomBy(delta: number) {
    setFit(false);
    setZoom((z) => {
      const base = fit ? 1 : z;
      return Math.min(6, Math.max(1, +(base + delta).toFixed(1)));
    });
  }

  async function savePhoto() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const file = new File([blob], fileName || 'sheet.jpg', { type: blob.type || 'image/jpeg' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file] });
        return;
      }
    } catch {
      /* fall through to the long-press hint */
    }
    setHint(true);
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setZoom(1);
          setFit(true);
          setHint(false);
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-base font-bold text-soft"
      >
        🖼 {t('viewSource')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-2 p-3 text-white">
            <div className="flex items-center gap-2">
              <button onClick={() => zoomBy(-0.5)} className="rounded-lg bg-white/15 px-4 py-2 text-lg" aria-label="−">−</button>
              <span className="w-14 text-center text-base">{fit ? t('fit') : `${Math.round(zoom * 100)}%`}</span>
              <button onClick={() => zoomBy(0.5)} className="rounded-lg bg-white/15 px-4 py-2 text-lg" aria-label="+">+</button>
              <button onClick={() => { setFit(true); setZoom(1); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${fit ? 'bg-gold text-navy-900' : 'bg-white/15'}`}>⤢ {t('fit')}</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={savePhoto} className="rounded-lg bg-gold px-4 py-2 text-base font-bold text-navy-900">📷 {t('savePhoto')}</button>
              <button onClick={() => setOpen(false)} className="rounded-lg bg-white/15 px-4 py-2 text-lg" aria-label={t('close')}>✕</button>
            </div>
          </div>

          {hint && (
            <div className="mx-3 mb-2 rounded-xl bg-white/95 px-4 py-3 text-center text-base font-medium text-navy-800">
              {t('savePhotoHint')}
            </div>
          )}

          {/* Scrollable + pinch-zoomable viewport. `pan-x pan-y` keeps one-finger scrolling. */}
          <div className="flex-1 overflow-auto p-3" style={{ touchAction: 'pan-x pan-y pinch-zoom', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {fit ? (
              <div className="flex min-h-full items-center justify-center">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={fileName} className="block max-h-[82vh] w-auto max-w-full rounded bg-white" draggable={false} />
                  <Stamp wm={watermark} />
                </div>
              </div>
            ) : (
              <div className="relative mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={fileName} className="block w-full rounded bg-white" draggable={false} />
                <Stamp wm={watermark} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
