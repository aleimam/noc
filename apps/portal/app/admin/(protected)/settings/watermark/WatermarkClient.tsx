'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { saveStamp, restampCategory, revertCategory } from './actions';
import { ContactsManager, type Contact } from './ContactsManager';
import { STAMP_CATEGORIES, BAKED_CATEGORIES, type StampCategory, type StampConfig, type StampPosition, type StampSettings } from '../../../../../lib/stampTypes';

type TypeOption = { id: string; nameAr: string; nameEn: string };

const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
// Module scope can't see the locale, so labels are stored as [ar, en] and spread into L(...).
const POS_LABEL: Record<StampPosition, readonly [string, string]> = {
  'top-left': ['أعلى اليسار', 'Top left'], 'top-right': ['أعلى اليمين', 'Top right'], center: ['الوسط', 'Center'],
  'bottom-left': ['أسفل اليسار', 'Bottom left'], 'bottom-right': ['أسفل اليمين', 'Bottom right'],
};
const CAT_LABEL: Record<StampCategory, readonly [string, string]> = {
  listing: ['صور الأراضي والإعلانات', 'Land & listing photos'],
  map: ['الخرائط — نسخة موقع الصواري', 'Maps — Al Sawarey copy'],
  'map-newobour': ['الخرائط — نسخة موقع العبور الجديدة', 'Maps — New Obour copy'],
  amenity: ['مرافق المنطقة (المرافق العامة)', 'Area amenities (public facilities)'],
  'area-update': ['تحديثات المناطق (الأخبار)', 'Area updates (news)'],
  'rationing-scan': ['كشوف التقنين (عرض مباشر)', 'Rationing sheets (live overlay)'],
  other: ['صور أخرى (غير مصنّفة)', 'Other photos (uncategorised)'],
};
const BRANDS: { brand: string; label: readonly [string, string]; cats: StampCategory[] }[] = [
  { brand: 'alsawarey', label: ['الصواري', 'Al Sawarey'], cats: STAMP_CATEGORIES.filter((c) => c === 'listing' || c === 'map') },
  { brand: 'newobour', label: ['العبور الجديدة', 'New Obour'], cats: STAMP_CATEGORIES.filter((c) => c !== 'listing' && c !== 'map') },
];
const inp = 'mt-1 w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
// Which brand's default logo a category falls back to (mirrors brandForCategory on the server).
const catBrandLabel = (cat: StampCategory): readonly [string, string] =>
  cat === 'listing' || cat === 'map' ? ['الصواري', 'Al Sawarey'] : ['العبور الجديدة', 'New Obour'];
const catBrandDomain = (cat: StampCategory) => (cat === 'listing' || cat === 'map' ? 'alsawarey.com' : 'newobour.com');

/** Live preview: POSTs the CURRENT (unsaved) config to the stamp engine and shows a real sample
 *  photo of the same category, stamped. Debounced; only calls the server while a logo or footer
 *  is enabled (nothing to preview otherwise). */
function StampPreview({ category, config }: { category: StampCategory; config: StampConfig }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const on = config.logoEnabled || config.wmEnabled || config.footerEnabled;
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
        <span className="text-sm font-semibold text-primary">{L('معاينة مباشرة', 'Live preview')}</span>
        {on && loading && <span className="text-xs opacity-60">{L('جارٍ التحديث…', 'Updating…')}</span>}
      </div>
      {!on ? (
        <p className="py-6 text-center text-xs opacity-60">{L('فعّل «ختم الشعار» أو «العلامة المائية» أو «شريط التذييل» لرؤية المعاينة على صورة تجريبية.', 'Enable the logo stamp, watermark or footer bar to preview it on a sample photo.')}</p>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={L('معاينة الختم', 'Stamp preview')} className="mx-auto max-h-72 w-auto rounded-md border border-graphite/15" />
      ) : (
        <p className="py-6 text-center text-xs opacity-60">{loading ? '…' : L('تعذّرت المعاينة', 'Preview failed')}</p>
      )}
      <p className="mt-2 text-center text-[11px] leading-relaxed opacity-50">{L('صورة تجريبية من نفس النوع — تُحدَّث بعد كل تعديل. تعرض تنسيق الشعار/التذييل بصرف النظر عن المفتاح الرئيسي.', 'A sample photo of the same category, refreshed after every change. It shows the logo/footer layout regardless of the master switch.')}</p>
    </div>
  );
}

export function WatermarkClient({ initial, contacts, typeOptions }: { initial: StampSettings; contacts: Contact[]; typeOptions: TypeOption[] }) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [s, setS] = useState<StampSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [addSel, setAddSel] = useState('');
  const [brandTab, setBrandTab] = useState(BRANDS[0]!.brand);
  // Unsaved-changes tracking: compare against the last saved snapshot, not the mount prop.
  const [savedSnap, setSavedSnap] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(s) !== savedSnap;

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
      if (r.ok) setSavedSnap(JSON.stringify(s));
      setMsg(r.ok ? L('تم الحفظ ✓', 'Saved ✓') : L('فشل الحفظ', 'Save failed'));
    });
  }
  // Re-stamp SAVES the current settings first — otherwise photos would be re-baked with the
  // previously saved config while the live preview shows the new one (a nasty trap).
  function restamp(cat: StampCategory) {
    if (!confirm(L('سيتم حفظ الإعدادات الحالية ثم إعادة توليد صور هذه الفئة من النسخ الأصلية النقية. متابعة؟', 'This saves the current settings, then regenerates this category\u2019s photos from the untouched originals. Continue?'))) return;
    setMsg('');
    start(async () => {
      const sv = await saveStamp(s);
      if (!sv.ok) { setMsg(L('فشل الحفظ', 'Save failed')); return; }
      setSavedSnap(JSON.stringify(s));
      const r = await restampCategory(cat);
      setMsg(r.ok ? L(`تم الحفظ وتمت معالجة ${r.count} صورة ✓`, `Saved and processed ${r.count} photo(s) ✓`) : r.error === 'not_bakeable' ? L('هذه الفئة تُختم عند العرض مباشرة', 'This category is stamped live on display') : L('فشلت العملية', 'The operation failed'));
    });
  }
  function revert(cat: StampCategory) {
    if (!confirm(L('سيتم إرجاع صور هذه الفئة إلى نسخها الأصلية بدون ختم. متابعة؟', 'This reverts this category\u2019s photos to their unstamped originals. Continue?'))) return;
    setMsg('');
    start(async () => {
      const r = await revertCategory(cat);
      setMsg(r.ok ? L(`تمت إعادة ${r.count} صورة للأصل ✓`, `Reverted ${r.count} photo(s) ✓`) : L('فشلت العملية', 'The operation failed'));
    });
  }

  // Shared config controls (used by both a photo category and a per-Type override).
  // Three independent layers, each in its own box: corner stamp · centered transparent
  // watermark · footer bar. The corner stamp and the watermark can carry DIFFERENT logos.
  function configControls(c: StampConfig, onPatch: (p: Partial<StampConfig>) => void, cat: StampCategory) {
    const group = 'space-y-3 rounded-md border border-graphite/15 bg-white/50 p-3';
    return (
      <>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={c.enabled} onChange={(e) => onPatch({ enabled: e.target.checked })} /> {L('تفعيل الختم لهذه الفئة', 'Enable stamping for this category')}</label>

        {/* ── Layer 1: corner logo stamp ── */}
        <div className={group}>
          <label className="flex items-center gap-2 text-sm font-bold text-primary"><input type="checkbox" checked={c.logoEnabled} onChange={(e) => onPatch({ logoEnabled: e.target.checked })} /> {L('١· ختم الشعار (في زاوية أو منتصف الصورة)', '1 · Logo stamp (corner or centre)')}</label>
          <div>
            <div className="mb-1 text-sm opacity-70">{L('شعار مخصّص (اختياري — الافتراضي شعار العلامة التجارية)', 'Custom logo (optional — defaults to the brand logo)')}</div>
            <ImageAttachment value={c.logoPath ? { id: '', path: c.logoPath, originalName: '' } : null} onChange={(a: UploadedAttachment | null) => onPatch({ logoPath: a?.path ?? null })} />
            <p className={`mt-1 text-xs ${c.logoPath ? 'text-green' : 'opacity-70'}`}>
              {c.logoPath
                ? L('✓ سيُستخدم الشعار المرفوع هنا في الختم', '✓ The logo uploaded here will be used for stamping')
                : L(`سيُستخدم شعار «${L(...catBrandLabel(cat))}» الافتراضي (من صفحة «الشعارات والهوية»)`, `The default «${L(...catBrandLabel(cat))}» logo will be used (from the Logos & identity page)`)}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">{L('الموضع', 'Position')}
              <select value={c.position} onChange={(e) => onPatch({ position: e.target.value as StampPosition })} className={inp}>
                {POSITIONS.map((p) => <option key={p} value={p}>{L(...POS_LABEL[p])}</option>)}
              </select>
            </label>
            <label className="text-sm">{L('الشفافية', 'Opacity')}: {Math.round(c.opacity * 100)}%
              <input type="range" min={10} max={100} step={5} value={Math.round(c.opacity * 100)} onChange={(e) => onPatch({ opacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
            </label>
            <label className="text-sm">{L('الحجم', 'Size')}: {c.scale}%
              <input type="range" min={5} max={50} step={1} value={c.scale} onChange={(e) => onPatch({ scale: parseInt(e.target.value, 10) })} className="w-full" />
            </label>
          </div>
        </div>

        {/* ── Layer 2: big transparent centered watermark (not applicable to the live scan overlay) ── */}
        {cat !== 'rationing-scan' && (
          <div className={group}>
            <label className="flex items-center gap-2 text-sm font-bold text-primary"><input type="checkbox" checked={c.wmEnabled} onChange={(e) => onPatch({ wmEnabled: e.target.checked })} /> {L('٢· علامة مائية شفافة في منتصف الصورة', '2 · Transparent watermark in the centre')}</label>
            <p className="text-xs opacity-60">{L('طبقة مستقلة عن ختم الزاوية — يمكن تفعيل الاثنين معًا وبشعارين مختلفين.', 'A separate layer from the corner stamp — both can run together with different logos.')}</p>
            <div>
              <div className="mb-1 text-sm opacity-70">{L('شعار العلامة المائية (اختياري)', 'Watermark logo (optional)')}</div>
              <ImageAttachment value={c.wmLogoPath ? { id: '', path: c.wmLogoPath, originalName: '' } : null} onChange={(a: UploadedAttachment | null) => onPatch({ wmLogoPath: a?.path ?? null })} />
              <p className={`mt-1 text-xs ${c.wmLogoPath ? 'text-green' : 'opacity-70'}`}>
                {c.wmLogoPath ? L('✓ سيُستخدم هذا الشعار للعلامة المائية', '✓ This logo will be used for the watermark') : L('سيُستخدم نفس شعار الختم أعلاه (المخصّص أو شعار العلامة التجارية)', 'The stamp logo above will be reused (custom, or the brand logo)')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">{L('الشفافية', 'Opacity')}: {Math.round((c.wmOpacity ?? 0.15) * 100)}%
                <input type="range" min={5} max={60} step={5} value={Math.round((c.wmOpacity ?? 0.15) * 100)} onChange={(e) => onPatch({ wmOpacity: parseInt(e.target.value, 10) / 100 })} className="w-full" />
              </label>
              <label className="text-sm">{L('الحجم', 'Size')}: {c.wmScale ?? 45}%
                <input type="range" min={20} max={90} step={5} value={c.wmScale ?? 45} onChange={(e) => onPatch({ wmScale: parseInt(e.target.value, 10) })} className="w-full" />
              </label>
            </div>
          </div>
        )}

        {/* ── Layer 3: footer bar ── */}
        <div className={group}>
          <label className="flex items-center gap-2 text-sm font-bold text-primary"><input type="checkbox" checked={c.footerEnabled} onChange={(e) => onPatch({ footerEnabled: e.target.checked })} /> {L('٣· شريط تذييل ببيانات التواصل والأيقونات', '3 · Footer bar with contact details and icons')}</label>
          <p className="text-xs opacity-60">{L(`يعرض تلقائيًا بيانات تواصل «${L(...catBrandLabel(cat))}» المُدارة أعلى هذا القسم. النصان أدناه احتياطيان — يُستخدمان فقط إذا لم تُدخل أي بيانات تواصل.`, `Automatically shows the «${L(...catBrandLabel(cat))}» contact details managed above. The two lines below are fallbacks — used only when no contact details are entered.`)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{L('نص احتياطي (سطر ١)', 'Fallback text (line 1)')}<input value={c.footerLine1} onChange={(e) => onPatch({ footerLine1: e.target.value })} className={inp} placeholder={`01xxxxxxxxx · ${L(...catBrandLabel(cat))}`} /></label>
            <label className="text-sm">{L('نص احتياطي (سطر ٢)', 'Fallback text (line 2)')}<input dir="ltr" value={c.footerLine2} onChange={(e) => onPatch({ footerLine2: e.target.value })} className={inp} placeholder={catBrandDomain(cat)} /></label>
          </div>
        </div>

        <StampPreview category={cat} config={c} />
      </>
    );
  }

  function catSection(cat: StampCategory) {
    const c = s.categories[cat];
    const bakeable = BAKED_CATEGORIES.includes(cat) || cat === 'map' || cat === 'map-newobour';
    return (
      <section className={`space-y-3 rounded-lg border border-graphite/15 p-4 ${!s.global ? 'opacity-60' : ''}`}>
        <h3 className="font-semibold text-primary">{L(...CAT_LABEL[cat])}</h3>
        {configControls(c, (p) => patch(cat, p), cat)}
        {cat === 'rationing-scan' ? (
          <p className="text-xs text-primary/70">{L('تُختم كشوف التقنين عند العرض مباشرةً — لا حاجة لإعادة الختم.', 'Rationing sheets are stamped live on display — no re-stamping needed.')}</p>
        ) : bakeable ? (
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => restamp(cat)} className="rounded-md border border-graphite/25 px-4 py-1.5 text-sm disabled:opacity-50">{L('إعادة ختم الصور الحالية', 'Re-stamp existing photos')}</button>
            <button disabled={pending} onClick={() => revert(cat)} className="rounded-md border border-red-300 px-4 py-1.5 text-sm text-red-600 disabled:opacity-50">{L('إرجاع للأصل (بدون ختم)', 'Revert to originals (unstamped)')}</button>
          </div>
        ) : null}

        {/* Per-listing-category rules (Type overrides) — only under the listing section. */}
        {cat === 'listing' && (
          <div className="space-y-3 rounded-md border border-dashed border-gold-400 bg-gold/5 p-3">
            <div className="text-sm font-bold text-primary">{L('قواعد حسب فئة الإعلان', 'Rules by listing type')}</div>
            <p className="text-xs opacity-60">{L('خصّص الختم لأنواع إعلانات معيّنة (مثلاً «أرض» تختلف عن «شقة»). الأنواع بلا قاعدة تستخدم الإعدادات أعلاه. تُطبَّق تلقائياً عند حفظ الإعلان، أو بزر «إعادة الختم».', 'Tailor stamping to specific listing types (e.g. Land differs from Apartment). Types without a rule use the settings above. Applied automatically on listing save, or via Re-stamp.')}</p>
            {Object.keys(s.listingTypeOverrides).map((tid) => {
              const t = typeOptions.find((x) => x.id === tid);
              return (
                <div key={tid} className="space-y-3 rounded-md border border-graphite/15 bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy-800">🏷️ {t?.nameAr ?? tid}</span>
                    <button type="button" onClick={() => removeOverride(tid)} className="text-xs text-red-600">{L('حذف القاعدة', 'Delete rule')}</button>
                  </div>
                  {configControls(s.listingTypeOverrides[tid]!, (p) => patchOverride(tid, p), 'listing')}
                </div>
              );
            })}
            {typeOptions.filter((t) => !s.listingTypeOverrides[t.id]).length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addSel} onChange={(e) => setAddSel(e.target.value)} className="rounded-md border border-graphite/20 bg-transparent px-2 py-1.5 text-sm">
                  <option value="">{L('اختر نوع الإعلان…', 'Choose a listing type…')}</option>
                  {typeOptions.filter((t) => !s.listingTypeOverrides[t.id]).map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
                </select>
                <button type="button" onClick={() => { if (addSel) { addOverride(addSel); setAddSel(''); } }} className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft disabled:opacity-50" disabled={!addSel}>{L('+ إضافة قاعدة', '+ Add rule')}</button>
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
        {L('كل صورة تُحفظ نسخة أصلية نقية لا تُمَس؛ والختم يُشتق منها دائماً — لذا يمكنك التبديل أو تغيير التنسيق أو إعادة الختم أو الإرجاع للأصل دون أي فقدان للبيانات. الصفحة مقسّمة حسب العلامة التجارية.', 'Every photo keeps an untouched pure original, and the stamp is always derived from it — so you can toggle, restyle, re-stamp or revert with no data loss. This page is split by brand.')}
      </div>

      <section className="space-y-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <label className="flex items-center gap-3 text-base font-bold text-primary">
          <input type="checkbox" className="h-5 w-5" checked={s.global} onChange={(e) => setS((prev) => ({ ...prev, global: e.target.checked }))} />
          {L('تشغيل الختم على مستوى النظام (المفتاح الرئيسي)', 'System-wide stamping (master switch)')}
        </label>
        <p className="text-xs opacity-60">{L('عند إيقافه لا تُختم أي صورة في أي قسم. عند تشغيله تعمل كل فئة مُفعَّلة حسب تنسيقها.', 'When off, nothing is stamped anywhere. When on, each enabled category follows its own layout.')}</p>
      </section>

      {/* Brand tabs — the settings for BOTH brands stay loaded in state; the tabs only switch
          which one is visible, so unsaved edits survive switching back and forth. */}
      <div className="flex gap-2" role="tablist" aria-label={L('العلامة التجارية', 'Brand')}>
        {BRANDS.map((b) => (
          <button
            key={b.brand}
            type="button"
            role="tab"
            aria-selected={brandTab === b.brand}
            onClick={() => setBrandTab(b.brand)}
            className={`min-h-[44px] flex-1 rounded-xl border-2 px-4 py-2 text-base font-black transition ${
              brandTab === b.brand
                ? 'border-navy-800 bg-navy-800 text-soft shadow'
                : 'border-navy-800/25 bg-navy-800/[0.03] text-navy-800 hover:bg-navy-800/10'
            }`}
          >
            🏷️ {L(...b.label)}
            <span className={`block text-[11px] font-normal ${brandTab === b.brand ? 'opacity-80' : 'opacity-60'}`} dir="ltr">
              {b.brand === 'alsawarey' ? 'alsawarey.com' : 'newobour.com'}
            </span>
          </button>
        ))}
      </div>

      {BRANDS.filter((b) => b.brand === brandTab).map((b) => (
        <div key={b.brand} className="space-y-3 rounded-xl border-2 border-navy-800/20 bg-navy-800/[0.03] p-3">
          <p className="px-1 text-xs opacity-60">{L(`إعدادات ختم صور موقع ${b.brand === 'alsawarey' ? 'alsawarey.com' : 'newobour.com'} — بيانات التواصل والفئات أدناه تخص هذا الموقع فقط.`, `Photo-stamping settings for ${b.brand === 'alsawarey' ? 'alsawarey.com' : 'newobour.com'} — the contacts and categories below apply to this site only.`)}</p>
          <ContactsManager brand={b.brand} brandLabel={L(...b.label)} contacts={contacts.filter((c) => c.brand === b.brand)} />
          {b.cats.map((cat) => <div key={cat}>{catSection(cat)}</div>)}
        </div>
      ))}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-graphite/15 bg-soft py-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2 text-sm text-soft disabled:opacity-50">{pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الإعدادات', 'Save settings')}</button>
        {dirty && !pending && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{L('تغييرات غير محفوظة', 'Unsaved changes')}</span>}
        {msg && <span className="text-sm text-green">{msg}</span>}
      </div>
    </div>
  );
}
