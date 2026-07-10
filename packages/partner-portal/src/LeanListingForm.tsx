'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImageAttachment, type UploadedAttachment } from '@noc/ui';
import { savePartnerListing, type LeanListingInput, type LeanValueInput } from './listingSave';

type COption = { id: string; nameAr: string; nameEn: string; granted: boolean };
type Classifier = { id: string; key: string; nameAr: string; nameEn: string; options: COption[] };
type Attr = { id: string; sectionId: string; labelAr: string; labelEn: string; type: string; unit: string | null; options: { id: string; labelAr: string; labelEn: string }[]; usesList: boolean; optionIds: string[] };
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

const inp = 'w-full rounded-md border border-graphite/25 bg-transparent px-3 py-2 text-sm';

/** Lean listing create/edit form for partners: classifiers → applicable attributes (simple inputs)
 *  → title/price/description/photos/contact. No rich-text or map annotator (staff-only). */
export function LeanListingForm({ catalog, initial = {}, locale, returnTo = '/partner' }: { catalog: LeanCatalog; initial?: LeanInitial; locale: 'ar' | 'en'; returnTo?: string }) {
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

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

  const setVal = (id: string, v: string | boolean | string[]) => setVals((p) => ({ ...p, [id]: v }));
  const label = (o: { nameAr?: string; nameEn?: string; labelAr?: string; labelEn?: string }) => L(o.nameAr ?? o.labelAr ?? '', o.nameEn ?? o.labelEn ?? '');

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
      : L('تعذّر الحفظ، تحقق من الحقول', 'Could not save, check the fields');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!typeId || !purposeId || !condId || !title.trim() || !contactPhone.trim()) { setError(L('أكمل الحقول المطلوبة', 'Fill the required fields')); return; }
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
    if (a.type === 'SELECT' || GEO_TYPES.has(a.type)) {
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">{L('النوع', 'Type')}
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} required className={`${inp} mt-1`}>
            <option value="">{L('— اختر —', '— select —')}</option>
            {grantedTypes.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L('الغرض', 'Purpose')}
          <select value={purposeId} onChange={(e) => setPurposeId(e.target.value)} required className={`${inp} mt-1`}>
            <option value="">{L('— اختر —', '— select —')}</option>
            {purposeC?.options.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{L('الحالة', 'Condition')}
          <select value={condId} onChange={(e) => setCondId(e.target.value)} required className={`${inp} mt-1`}>
            <option value="">{L('— اختر —', '— select —')}</option>
            {condC?.options.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
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
            {attrs.map((a) => (
              <div key={a.id} className="text-sm">
                <div className="mb-1 font-semibold">{label(a)}{a.unit ? ` (${a.unit})` : ''}</div>
                {renderAttr(a)}
              </div>
            ))}
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
        <ImageAttachment key={photos.length} value={null} onChange={(a) => a && setPhotos((s) => [...s, a])} stampCategory="listing" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">{L('هاتف التواصل', 'Contact phone')}
          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required className={`${inp} mt-1`} />
        </label>
        <label className="flex items-end gap-2 text-sm font-semibold"><input type="checkbox" checked={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.checked)} /> {L('واتساب متاح', 'WhatsApp available')}</label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-soft disabled:opacity-50">{initial.id ? L('حفظ التعديلات', 'Save changes') : L('نشر الإعلان', 'Submit listing')}</button>
        <a href={returnTo} className="text-sm text-ink-500">{L('إلغاء', 'Cancel')}</a>
        <span className="text-xs opacity-60">{L('تخضع الإعلانات للمراجعة قبل النشر.', 'Listings are reviewed before publishing.')}</span>
      </div>
    </form>
  );
}
