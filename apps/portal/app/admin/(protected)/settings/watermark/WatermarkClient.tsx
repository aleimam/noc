'use client';

import { useState, useTransition } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveStamp, restampListingPhotos, restampMaps } from './actions';
import type { StampCategory, StampConfig, StampPosition, StampSettings } from '../../../../../lib/stamp';

const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const CAT_LABEL: Record<StampCategory, string> = { listing: 'صور الأراضي (الصواري)', map: 'الخرائط (الموقع والمخطط)' };

export function WatermarkClient({ initial }: { initial: StampSettings }) {
  const [s, setS] = useState<StampSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const patch = (cat: StampCategory, p: Partial<StampConfig>) => setS((prev) => ({ ...prev, [cat]: { ...prev[cat], ...p } }));

  function save() {
    setMsg('');
    start(async () => {
      const r = await saveStamp(s);
      setMsg(r.ok ? 'تم الحفظ ✓' : 'فشل الحفظ');
    });
  }
  function restamp(kind: 'listing' | 'map') {
    if (!confirm('سيتم إعادة ختم الصور الحالية بالإعدادات الجديدة. متابعة؟')) return;
    setMsg('');
    start(async () => {
      const r = kind === 'listing' ? await restampListingPhotos() : await restampMaps();
      setMsg(r.ok ? `تم ختم ${r.count} عنصر ✓` : r.error === 'disabled' ? 'فعّل الختم واحفظ أولاً' : 'فشلت العملية');
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        لكل فئة صور تنسيق ختم مستقل: شعار (الموضع والشفافية والحجم) وتذييل ببيانات التواصل. الصور الجديدة تُختم تلقائياً؛ ولختم الصور القديمة استخدم زر «ختم الصور الحالية». ملاحظة: ختم صور الأراضي يُطبَّق على الملف مباشرة (لا تُعِد الضغط أكثر من مرة)؛ الخرائط تُعاد من النسخة النظيفة بأمان.
      </div>

      {(['listing', 'map'] as StampCategory[]).map((cat) => {
        const c = s[cat];
        return (
          <section key={cat} className="space-y-3 rounded-lg border border-graphite/15 p-4">
            <h2 className="font-semibold text-primary">{CAT_LABEL[cat]}</h2>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={c.logoEnabled} onChange={(e) => patch(cat, { logoEnabled: e.target.checked })} /> ختم الشعار (علامة مائية)
            </label>

            <div>
              <div className="mb-1 text-sm opacity-70">شعار مخصّص (اختياري — الافتراضي شعار {cat === 'listing' ? 'الصواري' : 'العبور الجديد'})</div>
              <ImageAttachment value={c.logoPath ? { id: '', path: c.logoPath, originalName: '' } : null} onChange={(a: UploadedAttachment | null) => patch(cat, { logoPath: a?.path ?? null })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm">الموضع
                <select value={c.position} onChange={(e) => patch(cat, { position: e.target.value as StampPosition })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-sm">الشفافية: {Math.round(c.opacity * 100)}%
                <input type="range" min={10} max={100} step={5} value={Math.round(c.opacity * 100)} onChange={(e) => patch(cat, { opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
              </label>
              <label className="text-sm">الحجم: {c.scale}%
                <input type="range" min={5} max={50} step={1} value={c.scale} onChange={(e) => patch(cat, { scale: parseInt(e.target.value, 10) })} className="w-full" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={c.footerEnabled} onChange={(e) => patch(cat, { footerEnabled: e.target.checked })} /> شريط تذييل ببيانات التواصل
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">السطر الأول<input value={c.footerLine1} onChange={(e) => patch(cat, { footerLine1: e.target.value })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" placeholder="01040810000 · WhatsApp" /></label>
              <label className="text-sm">السطر الثاني<input dir="ltr" value={c.footerLine2} onChange={(e) => patch(cat, { footerLine2: e.target.value })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" placeholder="alsawarey.com" /></label>
            </div>
            <p className="text-xs opacity-50">يُفضَّل أرقام وروابط لاتينية في التذييل لضمان وضوحها.</p>

            <button disabled={pending} onClick={() => restamp(cat)} className="rounded-md border border-graphite/25 px-4 py-1.5 text-sm disabled:opacity-50">ختم الصور الحالية لهذه الفئة</button>
          </section>
        );
      })}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-graphite/15 bg-soft py-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {msg && <span className="text-sm text-green">{msg}</span>}
      </div>
    </div>
  );
}
