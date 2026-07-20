'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { REQUIRED_LISTING_ATTR_KEYS } from '@noc/config';
import { savePartnerListing, type LeanListingInput, type LeanValueInput } from './listingSave';

type COption = { id: string; nameAr: string; nameEn: string; granted: boolean; parentIds: string[] };
type Classifier = { id: string; key: string; nameAr: string; nameEn: string; options: COption[] };
type AttrOption = { id: string; labelAr: string; labelEn: string; districtId?: string };
type Attr = { id: string; key: string; sectionId: string; labelAr: string; labelEn: string; type: string; unit: string | null; options: AttrOption[]; usesList: boolean; optionIds: string[]; required?: boolean };

const REQUIRED_ATTR_KEYS = new Set<string>(REQUIRED_LISTING_ATTR_KEYS);
type Section = { id: string; nameAr: string; nameEn: string };

export type LeanCatalog = { classifiers: Classifier[]; sections: Section[]; attributes: Attr[] };
export type LeanInitial = {
  id?: string;
  typeOptionId?: string | null; purposeOptionId?: string | null; conditionOptionId?: string | null;
  title?: string; description?: string | null; price?: number | null; priceUnit?: string | null;
  contactPhone?: string; contactWhatsapp?: boolean;
  vals?: Record<string, string | boolean | string[]>;
  photos?: UploadedAttachment[];
};

const NUM_TYPES = new Set(['NUMBER', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED']);
const BOOL_TYPES = new Set(['BOOLEAN', 'YESNO']);
const GEO_TYPES = new Set(['DISTRICT', 'NEIGHBORHOOD']);
const SKIP_TYPES = new Set(['PHOTOS', 'DOCUMENTS']);

// text-base (16px) — anything smaller triggers iOS focus-zoom on the whole page (long phone form).
const inp = 'w-full rounded-md border border-graphite/25 bg-transparent px-3 py-2 text-base';

/** Lean listing create/edit form for partners: classifiers → applicable attributes (simple inputs)
 *  → title/price/description/photos/contact. No rich-text or map annotator (staff-only). */
export function LeanListingForm({ catalog, initial = {}, locale, returnTo = '/partner' }: { catalog: LeanCatalog; initial?: LeanInitial; locale: 'ar' | 'en'; returnTo?: string }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const errRef = useRef<HTMLParagraphElement>(null);

  // Bring the error message into view — on a long phone form it's otherwise off-screen.
  useEffect(() => {
    if (error) errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const byKey = (k: string) => catalog.classifiers.find((c) => c.key === k);
  const typeC = byKey('type'), purposeC = byKey('purpose'), condC = byKey('condition');

  const [typeId, setTypeId] = useState(initial.typeOptionId ?? '');
  const [purposeId, setPurposeId] = useState(initial.purposeOptionId ?? '');
  const [condId, setCondId] = useState(initial.conditionOptionId ?? '');
  const [title, setTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [price, setPrice] = useState(initial.price != null ? String(initial.price) : '');
  const [priceUnit, setPriceUnit] = useState(initial.priceUnit ?? 'TOTAL');
  const [contactPhone, setContactPhone] = useState(initial.contactPhone ?? '');
  const [contactWhatsapp, setContactWhatsapp] = useState(initial.contactWhatsapp ?? true);
  const [vals, setVals] = useState<Record<string, string | boolean | string[]>>(initial.vals ?? {});
  const [photos, setPhotos] = useState<UploadedAttachment[]>(initial.photos ?? []);

  const optClassifier = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog.classifiers) for (const o of c.options) m.set(o.id, c.id);
    return m;
  }, [catalog]);

  const chosen = useMemo(() => new Set([typeId, purposeId, condId].filter(Boolean)), [typeId, purposeId, condId]);

  // Applicable = attribute is curated (has classifier links) and, for every classifier it
  // constrains, one of its options is chosen. Mirrors the server-side applicability guard.
  const applicable = useMemo(() => {
    if (!typeId || !purposeId || !condId) return [] as Attr[];
    return catalog.attributes.filter((a) => {
      if (SKIP_TYPES.has(a.type) || a.optionIds.length === 0) return false;
      const byCls = new Map<string, string[]>();
      for (const oid of a.optionIds) {
        const cid = optClassifier.get(oid);
        if (!cid) continue;
        const arr = byCls.get(cid) ?? [];
        arr.push(oid);
        byCls.set(cid, arr);
      }
      if (byCls.size === 0) return false;
      for (const allowed of byCls.values()) if (!allowed.some((oid) => chosen.has(oid))) return false;
      return true;
    });
  }, [catalog, chosen, typeId, purposeId, condId, optClassifier]);

  const bySection = useMemo(() => {
    const g = new Map<string, Attr[]>();
    for (const a of applicable) {
      const arr = g.get(a.sectionId) ?? [];
      arr.push(a);
      g.set(a.sectionId, arr);
    }
    return catalog.sections.map((s) => ({ section: s, attrs: g.get(s.id) ?? [] })).filter((x) => x.attrs.length);
  }, [applicable, catalog.sections]);

  // Ids of required details left empty at the last submit — highlighted red on the form.
  const [missingAttrIds, setMissingAttrIds] = useState<Set<string>>(new Set());
  const setVal = (id: string, v: string | boolean | string[]) => {
    setVals((p) => ({ ...p, [id]: v }));
    setMissingAttrIds((m) => { if (!m.has(id)) return m; const n = new Set(m); n.delete(id); return n; });
  };
  const label = (o: { nameAr?: string; nameEn?: string; labelAr?: string; labelEn?: string }) => L(o.nameAr ?? o.labelAr ?? '', o.nameEn ?? o.labelEn ?? '');

  // Required details: admin-set DB flag (attr.required) is the source of truth; the hard-coded
  // REQUIRED_LISTING_ATTR_KEYS (city) is a fallback. A single-option required SELECT auto-selects
  // its one choice so a locked field (one city) never blocks the seller.
  // PHOTOS/DOCUMENTS can never be required (attachments — see the server exemption).
  const isRequiredAttr = (a: Attr) =>
    a.type !== 'PHOTOS' && a.type !== 'DOCUMENTS' && (!!a.required || REQUIRED_ATTR_KEYS.has(a.key));
  useEffect(() => {
    for (const a of applicable) {
      if (!isRequiredAttr(a) || a.type !== 'SELECT') continue;
      const cur = vals[a.id];
      if ((typeof cur !== 'string' || !cur) && a.options.length === 1) setVal(a.id, a.options[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicable, vals]);

  // Keyword-rich saved filename for photos (image SEO): type + district + neighborhood + city + title.
  const photoNameHint = useMemo(() => {
    const optName = (a?: Attr) => {
      if (!a) return '';
      const v = vals[a.id];
      if (typeof v !== 'string' || !v) return '';
      const o = a.options.find((x) => x.id === v);
      return o ? label(o) : '';
    };
    const typeOpt = typeC?.options.find((o) => o.id === typeId);
    const parts = [
      typeOpt ? label(typeOpt) : '',
      optName(applicable.find((a) => a.type === 'DISTRICT')),
      optName(applicable.find((a) => a.type === 'NEIGHBORHOOD')),
      optName(applicable.find((a) => a.key === 'city')),
      title.trim(),
    ].filter(Boolean);
    return parts.join(' ').trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicable, vals, typeId, title, locale]);

  function buildValues(): LeanValueInput[] {
    const out: LeanValueInput[] = [];
    for (const a of applicable) {
      const v = vals[a.id];
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      if (a.type === 'MULTI_SELECT') {
        const arr = v as string[];
        out.push(a.usesList ? { attributeId: a.id, listItemIds: arr } : { attributeId: a.id, optionIds: arr });
      } else if (a.type === 'SELECT') {
        out.push(a.usesList ? { attributeId: a.id, listItemIds: [v as string] } : { attributeId: a.id, optionIds: [v as string] });
      } else if (GEO_TYPES.has(a.type)) {
        out.push({ attributeId: a.id, text: v as string });
      } else if (BOOL_TYPES.has(a.type)) {
        out.push({ attributeId: a.id, bool: v as boolean });
      } else if (NUM_TYPES.has(a.type)) {
        const n = parseFloat(v as string);
        if (!Number.isNaN(n)) out.push({ attributeId: a.id, number: n });
      } else {
        out.push({ attributeId: a.id, text: v as string });
      }
    }
    return out;
  }

  function errMsg(code: string) {
    return code === 'invalid_phone' ? L('رقم هاتف غير صالح', 'Invalid phone')
      : code === 'category_not_allowed' ? L('غير مسموح لك بالنشر في هذا التصنيف', 'You are not allowed to post in this category')
      : code === 'forbidden' ? L('غير مصرح', 'Not allowed')
      : code === 'missing_required' ? L('أكمل البيانات المطلوبة (المعلَّمة بنجمة ★)', 'Fill the required details (marked with ★)')
      : L('تعذّر الحفظ، تحقق من الحقول', 'Could not save, check the fields');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!typeId || !purposeId || !condId || !title.trim() || !contactPhone.trim()) { setError(L('أكمل الحقول المطلوبة', 'Fill the required fields')); return; }
    // Mandatory basic details (e.g. the city) must be filled.
    const missingList = applicable.filter((a) => {
      if (!isRequiredAttr(a)) return false;
      const v = vals[a.id];
      // A boolean is an ANSWER either way — «لا» (false) on a required YESNO must pass.
      return Array.isArray(v) ? v.length === 0 : typeof v === 'string' ? !v.trim() : typeof v === 'boolean' ? false : !v;
    });
    if (missingList.length) {
      setMissingAttrIds(new Set(missingList.map((a) => a.id)));
      setError(`${L('أكمل الحقول المطلوبة', 'Fill the required fields')} — ${missingList.map((a) => label(a)).join('، ')}`);
      if (typeof document !== 'undefined') {
        setTimeout(() => document.getElementById(`attr-${missingList[0]!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
      return;
    }
    setMissingAttrIds(new Set());
    setError('');
    start(async () => {
      const input: LeanListingInput = {
        id: initial.id,
        typeOptionId: typeId, purposeOptionId: purposeId, conditionOptionId: condId,
        title: title.trim(), description: description.trim() || undefined,
        price: price.trim() ? Number(price) : null,
        priceUnit: priceUnit as 'TOTAL' | 'UNIT' | 'SQM',
        contactPhone: contactPhone.trim(), contactWhatsapp,
        values: buildValues(), photoIds: photos.map((p) => p.id),
      };
      const r = await savePartnerListing(input);
      if (r.ok) { router.push(returnTo); router.refresh(); }
      else setError(errMsg(r.error));
    });
  }

  function renderAttr(a: Attr) {
    const v = vals[a.id];
    if (a.type === 'MULTI_SELECT') {
      const arr = Array.isArray(v) ? v : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {a.options.map((o) => {
            const on = arr.includes(o.id);
            return <button type="button" key={o.id} onClick={() => setVal(a.id, on ? arr.filter((x) => x !== o.id) : [...arr, o.id])} className={`rounded-full px-2.5 py-1 text-xs ${on ? 'bg-primary text-soft' : 'border border-graphite/25'}`}>{label(o)}</button>;
          })}
        </div>
      );
    }
    if (a.type === 'DISTRICT') {
      return (
        <select
          value={(v as string) ?? ''}
          onChange={(e) => {
            const districtId = e.target.value;
            setVals((p) => {
              const next = { ...p, [a.id]: districtId };
              // Clear any NEIGHBORHOOD choice that no longer belongs to the chosen district.
              for (const nb of catalog.attributes) {
                if (nb.type !== 'NEIGHBORHOOD') continue;
                const cur = next[nb.id];
                if (typeof cur === 'string' && cur && !nb.options.some((o) => o.id === cur && o.districtId === districtId)) next[nb.id] = '';
              }
              return next;
            });
          }}
          className={inp}
        >
          <option value="">{L('— اختر —', '— select —')}</option>
          {a.options.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
        </select>
      );
    }
    if (a.type === 'NEIGHBORHOOD') {
      // Nested under DISTRICT: filter by the district chosen in the same form (staff-form rule).
      const districtAttr = applicable.find((x) => x.type === 'DISTRICT');
      const chosenDistrict = districtAttr && typeof vals[districtAttr.id] === 'string' ? (vals[districtAttr.id] as string) : '';
      const opts = chosenDistrict ? a.options.filter((o) => o.districtId === chosenDistrict) : a.options;
      return (
        <div>
          <select value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp}>
            <option value="">{L('— اختر —', '— select —')}</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
          {districtAttr && !chosenDistrict && (
            <p className="mt-1 text-xs opacity-60">{L('اختر المنطقة أولاً لتصفية المجاورات', 'Choose the district first to filter neighborhoods')}</p>
          )}
        </div>
      );
    }
    if (a.type === 'SELECT') {
      return (
        <select value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp}>
          <option value="">{L('— اختر —', '— select —')}</option>
          {a.options.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
        </select>
      );
    }
    if (BOOL_TYPES.has(a.type)) {
      return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={(e) => setVal(a.id, e.target.checked)} /> {L('نعم', 'Yes')}</label>;
    }
    if (NUM_TYPES.has(a.type)) {
      return <input type="number" value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
    }
    if (a.type === 'TEXTAREA') {
      return <textarea value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} rows={2} className={inp} />;
    }
    const htmlType = a.type === 'DATE' ? 'month' : a.type === 'DATE_FULL' ? 'date' : a.type === 'URL' ? 'url' : a.type === 'PHONE' ? 'tel' : 'text';
    return <input type={htmlType} value={(v as string) ?? ''} onChange={(e) => setVal(a.id, e.target.value)} className={inp} />;
  }

  const grantedTypes = typeC?.options.filter((o) => o.granted) ?? [];
  // Editing a listing whose Type grant was revoked: keep the current option visible (disabled)
  // so the select doesn't silently show empty / lose the value.
  const revokedType = typeId && !grantedTypes.some((o) => o.id === typeId) ? typeC?.options.find((o) => o.id === typeId) : undefined;
  // Hard nesting Type → Purpose → Condition (mirrors the staff form's visibleOptions):
  // unscoped options (no parents) always show; scoped ones only under their chosen parent.
  const nested = (opts: COption[] | undefined, parentId: string) =>
    (opts ?? []).filter((o) => !parentId || o.parentIds.length === 0 || o.parentIds.includes(parentId));
  const purposeOptions = nested(purposeC?.options, typeId);
  const condOptions = nested(condC?.options, purposeId);

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">{L('النوع', 'Type')}
          <select
            value={typeId}
            onChange={(e) => { setTypeId(e.target.value); setPurposeId(''); setCondId(''); }}
            required
            className={`${inp} mt-1`}
          >
            <option value="">{L('— اختر —', '— select —')}</option>
            {grantedTypes.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
            {revokedType && <option value={revokedType.id} disabled>{label(revokedType)} {L('(صلاحية ملغاة)', '(permission revoked)')}</option>}
          </select>
        </label>
        <label className="text-sm font-semibold">{L('الغرض', 'Purpose')}
          <select
            value={purposeId}
            onChange={(e) => { setPurposeId(e.target.value); setCondId(''); }}
            required
            className={`${inp} mt-1`}
          >
            <option value="">{L('— اختر —', '— select —')}</option>
            {purposeOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L('الحالة', 'Condition')}
          <select value={condId} onChange={(e) => setCondId(e.target.value)} required className={`${inp} mt-1`}>
            <option value="">{L('— اختر —', '— select —')}</option>
            {condOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </label>
      </div>

      {grantedTypes.length === 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{L('لا توجد تصنيفات مسموح لك بالنشر فيها — تواصل معنا.', 'You have no categories you may post in — contact us.')}</p>
      )}

      <label className="block text-sm font-semibold">{L('عنوان الإعلان', 'Title')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`${inp} mt-1`} />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold sm:col-span-2">{L('السعر', 'Price')}
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inp} mt-1`} />
        </label>
        <label className="text-sm font-semibold">{L('الوحدة', 'Unit')}
          <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={`${inp} mt-1`}>
            <option value="TOTAL">{L('إجمالي', 'Total')}</option>
            <option value="SQM">{L('للمتر', 'Per m²')}</option>
            <option value="UNIT">{L('للوحدة', 'Per unit')}</option>
          </select>
        </label>
      </div>

      {bySection.map(({ section, attrs }) => (
        <fieldset key={section.id} className="space-y-3 rounded-lg border border-graphite/15 p-3">
          <legend className="px-1 text-sm font-bold text-primary">{label(section)}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {attrs.map((a) => {
              const req = isRequiredAttr(a);
              const miss = missingAttrIds.has(a.id);
              return (
                <div key={a.id} id={`attr-${a.id}`} className={`text-sm ${miss ? 'rounded-lg bg-red-50 p-2 ring-2 ring-red-400' : ''}`}>
                  {/* red ★ marks a required detail; the explicit «مطلوب» word stays for the low-literacy audience */}
                  <div className="mb-1 font-semibold">{req && <span className="font-bold text-red-600" title={L('مطلوب', 'required')}>★ </span>}{label(a)}{a.unit ? ` (${a.unit})` : ''}{req && <span className="text-red-600"> ({L('مطلوب', 'required')})</span>}</div>
                  {renderAttr(a)}
                  {miss && <div className="mt-1 text-xs font-semibold text-red-600">{L('هذا الحقل مطلوب', 'This field is required')}</div>}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <label className="block text-sm font-semibold">{L('الوصف', 'Description')}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inp} mt-1`} />
      </label>

      <div className="space-y-2">
        <div className="text-sm font-semibold">{L('الصور', 'Photos')}</div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.path} alt="" className="h-20 w-20 rounded-md object-cover" />
                <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} aria-label={L('حذف الصورة', 'Remove photo')} className="absolute -end-1 -top-1 h-5 w-5 rounded-full bg-red-600 text-xs leading-none text-white">×</button>
              </div>
            ))}
          </div>
        )}
        <ImageAttachment key={photos.length} value={null} nameHint={photoNameHint} onChange={(a) => a && setPhotos((s) => [...s, a])} stampCategory="listing" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">{L('هاتف التواصل', 'Contact phone')}
          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required className={`${inp} mt-1`} />
        </label>
        <label className="flex items-end gap-2 text-sm font-semibold"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> {L('واتساب متاح', 'WhatsApp available')}</label>
      </div>

      {error && <p ref={errRef} className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-soft disabled:opacity-50">{initial.id ? L('حفظ التعديلات', 'Save changes') : L('نشر الإعلان', 'Submit listing')}</button>
        <a href={returnTo} className="text-sm text-ink-500">{L('إلغاء', 'Cancel')}</a>
        <span className="text-xs opacity-60">{L('تخضع الإعلانات للمراجعة قبل النشر.', 'Listings are reviewed before publishing.')}</span>
      </div>
    </form>
  );
}
