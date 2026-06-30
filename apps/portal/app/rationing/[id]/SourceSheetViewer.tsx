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
  const [zoom, setZoom] = useState(1);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setZoom(1);
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-soft"
      >
        🖼 {t('viewSource')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-between gap-3 p-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs opacity-80" dir="ltr">{fileName}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className="rounded bg-white/15 px-3 py-1.5 text-sm">−</button>
              <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(5, +(z + 0.5).toFixed(1)))} className="rounded bg-white/15 px-3 py-1.5 text-sm">+</button>
              <a href={src} download className="rounded bg-white/15 px-3 py-1.5 text-sm">{t('download')}</a>
              <button onClick={() => setOpen(false)} className="rounded bg-white/15 px-3 py-1.5 text-sm" aria-label={t('close')}>✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3" onClick={(e) => e.stopPropagation()}>
            <div className="relative mx-auto w-fit" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '900px' : 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={fileName} className="block w-full rounded bg-white" />
              <Stamp wm={watermark} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
