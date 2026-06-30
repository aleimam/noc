'use client';

import { useState, useTransition } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveWatermark, restampLandPhotos } from './actions';
import type { WatermarkConfig } from '../../../../../lib/watermark';

const POSITIONS: WatermarkConfig['position'][] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];

export function WatermarkClient({ initial }: { initial: WatermarkConfig }) {
  const [c, setC] = useState<WatermarkConfig>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const set = (patch: Partial<WatermarkConfig>) => setC((s) => ({ ...s, ...patch }));

  function save() {
    setMsg('');
    start(async () => {
      const r = await saveWatermark(c);
      setMsg(r.ok ? 'تم الحفظ ✓' : 'فشل الحفظ');
    });
  }
  function restamp() {
    if (!confirm('سيتم ختم كل صور الأراضي الحالية. متابعة؟')) return;
    setMsg('');
    start(async () => {
      const r = await restampLandPhotos();
      setMsg(r.ok ? `تم ختم ${r.count} صورة` : r.error === 'disabled' ? 'فعّل العلامة واحفظ أولاً' : 'فشلت العملية');
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        العلامة المائية للأراضي <b>متوقفة افتراضياً</b>. فعّلها وارفع الشعار واضبط الإعدادات ثم احفظ. الصور الجديدة ستُختم تلقائياً؛ ولختم الصور القديمة استخدم زر «ختم الصور الحالية».
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> تفعيل العلامة المائية على صور الأراضي
      </label>

      <div>
        <div className="mb-1 text-sm">شعار الختم</div>
        <ImageAttachment
          value={c.logoPath ? { id: '', path: c.logoPath, originalName: '' } : null}
          onChange={(a: UploadedAttachment | null) => set({ logoPath: a?.path ?? null })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">الموضع
          <select value={c.position} onChange={(e) => set({ position: e.target.value as WatermarkConfig['position'] })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm">الشفافية: {Math.round(c.opacity * 100)}%
          <input type="range" min={10} max={100} step={5} value={Math.round(c.opacity * 100)} onChange={(e) => set({ opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
        </label>
        <label className="text-sm">الحجم: {c.scale}% من عرض الصورة
          <input type="range" min={5} max={50} step={1} value={c.scale} onChange={(e) => set({ scale: parseInt(e.target.value, 10) })} className="w-full" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">حفظ</button>
        <button disabled={pending} onClick={restamp} className="rounded-md border border-graphite/25 px-4 py-2 text-sm disabled:opacity-50">ختم الصور الحالية</button>
        {msg && <span className="text-sm text-green">{msg}</span>}
      </div>
    </div>
  );
}
