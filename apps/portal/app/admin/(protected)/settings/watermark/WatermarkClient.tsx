'use client';

import { useState, useTransition } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveStamp, restampCategory, revertCategory } from './actions';
import { STAMP_CATEGORIES, BAKED_CATEGORIES, type StampCategory, type StampConfig, type StampPosition, type StampSettings } from '../../../../../lib/stampTypes';

const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const POS_LABEL: Record<StampPosition, string> = {
  'top-left': 'أعلى اليسار',
  'top-right': 'أعلى اليمين',
  center: 'الوسط',
  'bottom-left': 'أسفل اليسار',
  'bottom-right': 'أسفل اليمين',
};
const CAT_LABEL: Record<StampCategory, string> = {
  listing: 'صور الأراضي (الصواري)',
  map: 'الخرائط (الموقع والمخطط)',
  amenity: 'مرافق المنطقة (المرافق العامة)',
  'area-update': 'تحديثات المناطق (الأخبار)',
  'rationing-scan': 'كشوف التقنين (عرض مباشر)',
  other: 'صور أخرى (غير مصنّفة)',
};
const CAT_BRAND: Record<StampCategory, string> = {
  listing: 'الصواري',
  map: 'الصواري',
  amenity: 'العبور الجديد',
  'area-update': 'العبور الجديد',
  'rationing-scan': 'العبور الجديد',
  other: 'العبور الجديد',
};

export function WatermarkClient({ initial }: { initial: StampSettings }) {
  const [s, setS] = useState<StampSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  const patch = (cat: StampCategory, p: Partial<StampConfig>) =>
    setS((prev) => ({ ...prev, categories: { ...prev.categories, [cat]: { ...prev.categories[cat], ...p } } }));

  function save() {
    setMsg('');
    start(async () => {
      const r = await saveStamp(s);
      setMsg(r.ok ? 'تم الحفظ ✓' : 'فشل الحفظ');
    });
  }
  function restamp(cat: StampCategory) {
    if (!confirm('سيتم إعادة توليد صور هذه الفئة من النسخ الأصلية النقية بالإعدادات المحفوظة حالياً. متابعة؟')) return;
    setMsg('');
    start(async () => {
      const r = await restampCategory(cat);
      setMsg(r.ok ? `تمت معالجة ${r.count} صورة ✓` : r.error === 'not_bakeable' ? 'هذه الفئة تُختم عند العرض مباشرة' : 'فشلت العملية');
    });
  }
  function revert(cat: StampCategory) {
    if (!confirm('سيتم إرجاع صور هذه الفئة إلى نسخها الأصلية بدون ختم. متابعة؟')) return;
    setMsg('');
    start(async () => {
      const r = await revertCategory(cat);
      setMsg(r.ok ? `تمت إعادة ${r.count} صورة للأصل ✓` : 'فشلت العملية');
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        كل صورة تُحفظ نسخة أصلية نقية لا تُمَس؛ والختم يُشتق منها دائماً — لذا يمكنك التبديل أو تغيير التنسيق أو إعادة الختم أو الإرجاع للأصل دون أي فقدان للبيانات. المفتاح الرئيسي بالأسفل يتحكم في كل الفئات، ولكل فئة تحكّم مستقل في تشغيل الختم وتنسيقه.
      </div>

      {/* Global master switch */}
      <section className="space-y-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <label className="flex items-center gap-3 text-base font-bold text-primary">
          <input type="checkbox" className="h-5 w-5" checked={s.global} onChange={(e) => setS((prev) => ({ ...prev, global: e.target.checked }))} />
          تشغيل الختم على مستوى النظام (المفتاح الرئيسي)
        </label>
        <p className="text-xs opacity-60">عند إيقافه لا تُختم أي صورة في أي قسم، مهما كانت إعدادات الفئات. عند تشغيله تعمل كل فئة مُفعَّلة حسب تنسيقها.</p>
      </section>

      {STAMP_CATEGORIES.map((cat) => {
        const c = s.categories[cat];
        const bakeable = BAKED_CATEGORIES.includes(cat) || cat === 'map';
        return (
          <section key={cat} className={`space-y-3 rounded-lg border border-graphite/15 p-4 ${!s.global ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-primary">{CAT_LABEL[cat]}</h2>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={c.enabled} onChange={(e) => patch(cat, { enabled: e.target.checked })} /> تفعيل الختم لهذه الفئة
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.logoEnabled} onChange={(e) => patch(cat, { logoEnabled: e.target.checked })} /> ختم الشعار (علامة مائية)
            </label>

            <div>
              <div className="mb-1 text-sm opacity-70">شعار مخصّص (اختياري — الافتراضي شعار {CAT_BRAND[cat]})</div>
              <ImageAttachment value={c.logoPath ? { id: '', path: c.logoPath, originalName: '' } : null} onChange={(a: UploadedAttachment | null) => patch(cat, { logoPath: a?.path ?? null })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm">الموضع
                <select value={c.position} onChange={(e) => patch(cat, { position: e.target.value as StampPosition })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm">
                  {POSITIONS.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
                </select>
              </label>
              <label className="text-sm">الشفافية: {Math.round(c.opacity * 100)}%
                <input type="range" min={10} max={100} step={5} value={Math.round(c.opacity * 100)} onChange={(e) => patch(cat, { opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
              </label>
              <label className="text-sm">الحجم: {c.scale}%
                <input type="range" min={5} max={50} step={1} value={c.scale} onChange={(e) => patch(cat, { scale: parseInt(e.target.value, 10) })} className="w-full" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.footerEnabled} onChange={(e) => patch(cat, { footerEnabled: e.target.checked })} /> شريط تذييل ببيانات التواصل
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">السطر الأول<input value={c.footerLine1} onChange={(e) => patch(cat, { footerLine1: e.target.value })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" placeholder="01040810000 · WhatsApp" /></label>
              <label className="text-sm">السطر الثاني<input dir="ltr" value={c.footerLine2} onChange={(e) => patch(cat, { footerLine2: e.target.value })} className="mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm" placeholder="alsawarey.com" /></label>
            </div>
            <p className="text-xs opacity-50">يُفضَّل أرقام وروابط لاتينية في التذييل لضمان وضوحها.</p>

            {cat === 'rationing-scan' ? (
              <p className="text-xs text-primary/70">تُختم كشوف التقنين عند العرض مباشرةً حسب هذه الإعدادات — لا حاجة لإعادة ختم الصور المخزّنة.</p>
            ) : bakeable ? (
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} onClick={() => restamp(cat)} className="rounded-md border border-graphite/25 px-4 py-1.5 text-sm disabled:opacity-50">إعادة ختم الصور الحالية</button>
                <button disabled={pending} onClick={() => revert(cat)} className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 disabled:opacity-50">إرجاع للأصل (بدون ختم)</button>
              </div>
            ) : null}
          </section>
        );
      })}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-graphite/15 bg-soft py-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
        {msg && <span className="text-sm text-green">{msg}</span>}
      </div>
    </div>
  );
}
