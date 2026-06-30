'use client';

import { useState } from 'react';

// Renders the visitor's rationing result as a branded PNG they can keep on a borrowed
// phone (Golden Rule). Pure canvas — no deps. Arabic shaped via ctx.direction='rtl'.
export function SaveResultButton({
  title,
  subtitle,
  rows,
  saveLabel,
  preparingLabel,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  saveLabel: string;
  preparingLabel: string;
}) {
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const url = await render(title, subtitle, rows);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'result.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-base font-bold text-navy-900 disabled:opacity-50"
    >
      <span aria-hidden>⬇</span> {busy ? preparingLabel : saveLabel}
    </button>
  );
}

async function render(title: string, subtitle: string, rows: { label: string; value: string }[]): Promise<string> {
  const W = 720;
  const M = 36;
  const scale = 2;
  const headerH = 132;
  const rowH = 46;
  const footerH = 56;
  const H = headerH + rows.length * rowH + 24 + footerH;

  const logo = await loadImage('/brand/logo').catch(() => null);
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignore */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no ctx');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  if ('direction' in ctx) ctx.direction = 'rtl';

  const NAVY = '#0b1b33';
  const GOLD = '#c9983e';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, headerH);
  if (logo) {
    const lw = 48;
    const lh = (logo.height / logo.width) * lw || lw;
    ctx.drawImage(logo, W - M - lw, 16, lw, lh);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 30px Tajawal, Arial, sans-serif';
  ctx.fillText(title, W - M - 60, 56);
  ctx.fillStyle = '#cdd6e4';
  ctx.font = '18px Tajawal, Arial, sans-serif';
  ctx.fillText(subtitle, W - M - 60, 94);

  // rows
  let y = headerH + 12;
  for (const r of rows) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5c5c5c';
    ctx.font = '16px Tajawal, Arial, sans-serif';
    ctx.fillText(r.label, W - M, y + rowH / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = NAVY;
    ctx.font = 'bold 18px Tajawal, Arial, sans-serif';
    ctx.fillText(r.value, M, y + rowH / 2);
    ctx.strokeStyle = '#e2e2de';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, y + rowH);
    ctx.lineTo(W - M, y + rowH);
    ctx.stroke();
    y += rowH;
  }

  // footer
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa6b8';
  ctx.font = '14px Tajawal, Arial, sans-serif';
  ctx.fillText('بوابة خدمات مدينة العبور الجديدة · newobour.com', W / 2, H - footerH / 2);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
