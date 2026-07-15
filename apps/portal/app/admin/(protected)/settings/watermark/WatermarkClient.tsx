'use client';

import { useEffect, useState, useTransition } from 'react';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveStamp, restampCategory, revertCategory } from './actions';
import { ContactsManager, type Contact } from './ContactsManager';
import { STAMP_CATEGORIES, BAKED_CATEGORIES, type StampCategory, type StampConfig, type StampPosition, type StampSettings } from '../../../../../lib/stampTypes';

type TypeOption = { id: string; nameAr: string; nameEn: string };

const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const POS_LABEL: Record<StampPosition, string> = {
  'top-left': 'أعلى اليسار', 'top-right': 'أعلى اليمين', center: 'الوسط', 'bottom-left': 'أسفل اليسار', 'bottom-right': 'أسفل اليمين',
};
const CAT_LABEL: Record<StampCategory, string> = {
  listing: 'صور الأراضي والإعلانات',
  map: 'الخرائط (الموقع والمخطط)',
  amenity: 'مرافق المنطقة (المرافق العامة)',
  'area-update': 'تحديثات المناطق (الأخبار)',
  'rationing-scan': 'كشوف التقنين (عرض مباشر)',
  other: 'صور أخرى (غير مصنّفة)',
};
const BRANDS: { brand: string; label: string; cats: StampCategory[] }[] = [
  { brand: 'alsawarey', label: 'الصواري', cats: STAMP_CATEGORIES.filter((c) => c === 'listing' || c === 'map') },
  { brand: 'newobour', label: 'العبور الجديدة', cats: STAMP_CATEGORIES.filter((c) => c !== 'listing' && c !== 'map') },
];
const inp = 'mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';

/** Live preview: POSTs the CURRENT (unsaved) config to the stamp engine and shows a real sample
 *  photo of the same category, stamped. Debounced; only calls the server while a logo or footer
 *  is enabled (nothing to preview otherwise). */
function StampPreview({ category, config }: { category: StampCategory; config: StampConfig }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const on = config.logoEnabled || config.footerEnabled;
  const key = JSON.stringify(config);
  useEffect(() => {
    if (!on) {
      setUrl((p) => { if (p) URL.revokeObjectURL(p); return null; });
      return;
    }
    let alive = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch('/api/admin/watermark-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, config }),
        });
        if (!r.ok) throw new Error('preview');
        const blob = await r.blob();
        if (!alive) return;
        const obj = URL.createObjectURL(blob);
        setUrl((p) => { if (p) URL.revokeObjectURL(p); return obj; });
      } catch {
        if (alive) setUrl(null);
      } finally {
        if (alive) setLoading(false);
      }
    }, 450);
    return () => { alive = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, on, category]);

  return (
    <div className="rounded-lg border border-graphite/20 bg-graphite/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">معاينة مباشرة</span>
        {on && loading && <span className="text-xs opacity-60">جارٍ التحديث…</span>}
      </div>
      {!on ? (
        <p className="py-6 text-center text-xs opacity-60">فعّل «ختم الشعار» أو «شريط التذييل» لرؤية المعاينة على صورة تجريبية.</p>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="معاينة الختم" className="mx-auto max-h-72 w-auto rounded-md border border-graphite/15" />
      ) : (
        <p className="py-6 text-center text-xs opacity-60">{loading ? '…' : 'تعذّرت المعاينة'}</p>
      )}
      <p className="mt-2 text-center text-[11px] leading-relaxed opacity-50">صورة تجريبية من نفس النوع — تُحدَّث بعد كل تعديل. تعرض تنسيق الشعار/التذييل بصرف النظر عن المفتاح الرئيسي.</p>
    </div>
  );
}

export function WatermarkClient({ initial, contacts, typeOptions }: { initial: StampSettings; contacts: Contact[]; typeOptions: TypeOption[] }) {
  const [s, setS] = useState<StampSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [addSel, setAddSel] = useState('');

  const patch = (cat: StampCategory, p: Partial<StampConfig>) =>
    setS((prev) => ({ ...prev, categories: { ...prev.categories, [cat]: { ...prev.categories[cat], ...p } } }));
  const patchOverride = (id: string, p: Partial<StampConfig>) =>
    setS((prev) => ({ ...prev, listingTypeOverrides: { ...prev.listingTypeOverrides, [id]: { ...prev.listingTypeOverrides[id]!, ...p } } }));
  const addOverride = (id: string) =>
    setS((prev) => ({ ...prev, listingTypeOverrides: { ...prev.listingTypeOverrides, [id]: { ...prev.categories.listing } } }));
  const removeOverride = (id: string) =>
    setS((prev) => { const o = { ...prev.listingTypeOverrides }; delete o[id]; return { ...prev, listingTypeOverrides: o }; });

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

  // Shared config controls (used by both a photo category and a per-Type override).
  function configControls(c: StampConfig, onPatch: (p: Partial<StampConfig>) => void, cat: StampCategory) {
    return (
      <>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={c.enabled} onChange={(e) => onPatch({ enabled: e.target.checked })} /> تفعيل الختم</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.logoEnabled} onChange={(e) => onPatch({ logoEnabled: e.target.checked })} /> ختم الشعار في الزاوية (علامة مائية)</label>
        <div>
          <div className="mb-1 text-sm opacity-70">شعار مخصّص (اختياري — الافتراضي شعار العلامة التجارية)</div>
          <ImageAttachment value={c.logoPath ? { id: '', path: c.logoPath, originalName: '' } : null} onChange={(a: UploadedAttachment | null) => onPatch({ logoPath: a?.path ?? null })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">الموضع
            <select value={c.position} onChange={(e) => onPatch({ position: e.target.value as StampPosition })} className={inp}>
              {POSITIONS.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-sm">الشفافية: {Math.round(c.opacity * 100)}%
            <input type="range" min={10} max={100} step={5} value={Math.round(c.opacity * 100)} onChange={(e) => onPatch({ opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
          </label>
          <label className="text-sm">الحجم: {c.scale}%
            <input type="range" min={5} max={50} step={1} value={c.scale} onChange={(e) => onPatch({ scale: parseInt(e.target.value, 10) })} className="w-full" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.footerEnabled} onChange={(e) => onPatch({ footerEnabled: e.target.checked })} /> شريط تذييل ببيانات التواصل والأيقونات</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">نص احتياطي (سطر ١)<input value={c.footerLine1} onChange={(e) => onPatch({ footerLine1: e.target.value })} className={inp} placeholder="01040810000 · WhatsApp" /></label>
          <label className="text-sm">نص احتياطي (سطر ٢)<input dir="ltr" value={c.footerLine2} onChange={(e) => onPatch({ footerLine2: e.target.value })} className={inp} placeholder="alsawarey.com" /></label>
        </div>
        <StampPreview category={cat} config={c} />
      </>
    );
  }

  function catSection(cat: StampCategory) {
    const c = s.categories[cat];
    const bakeable = BAKED_CATEGORIES.includes(cat) || cat === 'map';
    return (
      <section className={`space-y-3 rounded-lg border border-graphite/15 p-4 ${!s.global ? 'opacity-60' : ''}`}>
        <h3 className="font-semibold text-primary">{CAT_LABEL[cat]}</h3>
        {configControls(c, (p) => patch(cat, p), cat)}
        {cat === 'rationing-scan' ? (
          <p className="text-xs text-primary/70">تُختم كشوف التقنين عند العرض مباشرةً — لا حاجة لإعادة الختم.</p>
        ) : bakeable ? (
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => restamp(cat)} className="rounded-md border border-graphite/25 px-4 py-1.5 text-sm disabled:opacity-50">إعادة ختم الصور الحالية</button>
            <button disabled={pending} onClick={() => revert(cat)} className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 disabled:opacity-50">إرجاع للأصل (بدون ختم)</button>
          </div>
        ) : null}

        {/* Per-listing-category rules (Type overrides) — only under the listing section. */}
        {cat === 'listing' && (
          <div className="space-y-3 rounded-md border border-dashed border-gold-400 bg-gold/5 p-3">
            <div className="text-sm font-bold text-primary">قواعد حسب فئة الإعلان</div>
            <p className="text-xs opacity-60">خصّص الختم لأنواع إعلانات معيّنة (مثلاً «أرض» تختلف عن «شقة»). الأنواع بلا قاعدة تستخدم الإعدادات أعلاه. تُطبَّق تلقائياً عند حفظ الإعلان، أو بزر «إعادة الختم».</p>
            {Object.keys(s.listingTypeOverrides).map((tid) => {
              const t = typeOptions.find((x) => x.id === tid);
              return (
                <div key={tid} className="space-y-3 rounded-md border border-graphite/15 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy-800">🏷️ {t?.nameAr ?? tid}</span>
                    <button type="button" onClick={() => removeOverride(tid)} className="text-xs text-red-600">حذف القاعدة</button>
                  </div>
                  {configControls(s.listingTypeOverrides[tid]!, (p) => patchOverride(tid, p), 'listing')}
                </div>
              );
            })}
            {typeOptions.filter((t) => !s.listingTypeOverrides[t.id]).length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addSel} onChange={(e) => setAddSel(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm">
                  <option value="">اختر نوع الإعلان…</option>
                  {typeOptions.filter((t) => !s.listingTypeOverrides[t.id]).map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
                </select>
                <button type="button" onClick={() => { if (addSel) { addOverride(addSel); setAddSel(''); } }} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50" disabled={!addSel}>+ إضافة قاعدة</button>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        كل صورة تُحفظ نسخة أصلية نقية لا تُمَس؛ والختم يُشتق منها دائماً — لذا يمكنك التبديل أو تغيير التنسيق أو إعادة الختم أو الإرجاع للأصل دون أي فقدان للبيانات. الصفحة مقسّمة حسب العلامة التجارية.
      </div>

      <section className="space-y-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <label className="flex items-center gap-3 text-base font-bold text-primary">
          <input type="checkbox" className="h-5 w-5" checked={s.global} onChange={(e) => setS((prev) => ({ ...prev, global: e.target.checked }))} />
          تشغيل الختم على مستوى النظام (المفتاح الرئيسي)
        </label>
        <p className="text-xs opacity-60">عند إيقافه لا تُختم أي صورة في أي قسم. عند تشغيله تعمل كل فئة مُفعَّلة حسب تنسيقها.</p>
      </section>

      {BRANDS.map((b) => (
        <div key={b.brand} className="space-y-3 rounded-xl border-2 border-navy-800/20 bg-navy-800/[0.03] p-3">
          <h2 className="px-1 text-lg font-black text-navy-800">🏷️ {b.label}</h2>
          <ContactsManager brand={b.brand} brandLabel={b.label} contacts={contacts.filter((c) => c.brand === b.brand)} />
          {b.cats.map((cat) => <div key={cat}>{catSection(cat)}</div>)}
        </div>
      ))}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-graphite/15 bg-soft py-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
        {msg && <span className="text-sm text-green">{msg}</span>}
      </div>
    </div>
  );
}
