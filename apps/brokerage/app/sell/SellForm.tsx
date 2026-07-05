'use client';

import { useRef, useState, useTransition, type ClipboardEvent, type DragEvent } from 'react';
import { useLocale } from 'next-intl';
import { compressImage, track } from '@noc/ui';
import { isValidPhone } from '@noc/config';
import { createLandOffer, type OfferInput } from './actions';

type Opt = { id: string; name: string };
type Hood = { id: string; name: string; districtId: string };
type Att = { id: string; path: string; name: string; isDoc: boolean };

const inp = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base';
const inpHi = 'w-full rounded-xl border-2 border-gold bg-gold-50 px-3.5 py-3 text-lg font-bold text-navy-900 shadow-sm outline-none';
const lbl = 'block text-sm font-medium text-navy-700';

export function SellForm({
  cities,
  districts,
  neighborhoods,
  policyHref,
}: {
  cities: Opt[];
  districts: Opt[];
  neighborhoods: Hood[];
  policyHref?: string;
}) {
  const ar = useLocale() === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const phoneErr = L('أدخل رقم موبايل صحيح: 11 رقمًا يبدأ بـ 01، أو رقمًا دوليًا يبدأ بعلامة +', 'Enter a valid phone: 11 digits starting with 01, or an international number starting with +');
  const lockedCity = cities.length === 1 ? (cities[0]?.id ?? '') : '';
  const [mode, setMode] = useState<'SHEET' | 'ALLOCATED'>('SHEET');
  const [f, setF] = useState<OfferInput>({ mode: 'SHEET', ownerName: '', phone1: '', cityId: lockedCity });
  const [att, setAtt] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const hoods = neighborhoods.filter((n) => n.districtId === f.districtId);

  async function addFiles(files: FileList | File[] | null) {
    if (!files || !('length' in files) || !files.length) return;
    setUploading(true);
    setError('');
    for (const file of Array.from(files)) {
      try {
        const isImg = file.type.startsWith('image/');
        const fd = new FormData();
        if (isImg) fd.append('file', await compressImage(file));
        else { fd.append('file', file); fd.append('kind', 'document'); }
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.attachment) setAtt((p) => [...p, { id: j.attachment.id, path: j.attachment.path, name: j.attachment.originalName || file.name, isDoc: !isImg }]);
        else setError(L('تعذّر رفع أحد الملفات', 'Could not upload one of the files'));
      } catch {
        setError(L('تعذّر رفع أحد الملفات', 'Could not upload one of the files'));
      }
    }
    setUploading(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void addFiles(e.dataTransfer.files);
  }
  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.items).map((i) => i.getAsFile()).filter((x): x is File => !!x);
    if (files.length) void addFiles(files);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.ownerName.trim() || !f.phone1.trim()) { setError(L('أدخل الاسم ورقم الهاتف', 'Enter your name and phone number')); return; }
    if (!isValidPhone(f.phone1)) { setError(phoneErr); return; }
    if (f.phone2?.trim() && !isValidPhone(f.phone2)) { setError(phoneErr); return; }
    setError('');
    start(async () => {
      const r = await createLandOffer({ ...f, mode, attachmentIds: att.map((p) => p.id) });
      if (r.ok) { track('sell_offer', { mode }); setDone(true); }
      else setError(r.error === 'invalid_phone' ? phoneErr : L('تعذّر الإرسال، حاول مرة أخرى', 'Could not send, please try again'));
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-success bg-white p-6 text-center">
        <div className="text-xl font-extrabold text-success">{L('تم استلام طلبك بنجاح', 'Your request was received')}</div>
        <p className="mt-2 text-ink-600">{L('سيتواصل معك فريق الصواري قريباً لتقييم أرضك والبدء في تسويقها.', 'The ALSWARY team will contact you soon to evaluate your land and start marketing it.')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-md">
      <div className="flex gap-2">
        {(['SHEET', 'ALLOCATED'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setF((s) => ({ ...s, mode: m })); }}
            className={`flex-1 rounded-xl border-2 px-4 py-3 text-base font-bold ${mode === m ? 'border-gold bg-gold-50 text-gold-800' : 'border-ink-200 text-ink-600'}`}>
            {m === 'SHEET' ? L('أرض في كشف التقنين', 'Land in a rationing sheet') : L('أرض مخصصة (تخصيص)', 'Allocated land')}
          </button>
        ))}
      </div>

      {/* Owner — full line */}
      <label className={lbl}>{L('اسم المالك', 'Owner name')}<input value={f.ownerName} onChange={set('ownerName')} className={inp} required /></label>

      {/* Both phones — same line */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className={lbl}>{L('رقم الهاتف', 'Phone number')}<input value={f.phone1} onChange={set('phone1')} dir="ltr" className={inp} required /></label>
        <label className={lbl}>{L('رقم هاتف آخر (اختياري)', 'Another phone (optional)')}<input value={f.phone2 ?? ''} onChange={set('phone2')} dir="ltr" className={inp} /></label>
      </div>

      {mode === 'SHEET' ? (
        // City + Actual area — one row
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className={lbl}>{L('المنطقة', 'City')}
            <select value={f.cityId ?? ''} onChange={set('cityId')} className={inp} disabled={cities.length <= 1}>
              {cities.length !== 1 && <option value="">{L('اختر…', 'Choose…')}</option>}
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className={lbl}>{L('المساحة الفعلية (م²)', 'Actual area (m²)')}<input value={f.area ?? ''} onChange={set('area')} dir="ltr" className={inp} /></label>
        </div>
      ) : (
        <>
          {/* Original + Actual area — one row */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className={lbl}>{L('المساحة الأصلية (م²)', 'Original area (m²)')}<input value={f.originalArea ?? ''} onChange={set('originalArea')} dir="ltr" className={inp} /></label>
            <label className={lbl}>{L('المساحة الفعلية (م²)', 'Actual area (m²)')}<input value={f.area ?? ''} onChange={set('area')} dir="ltr" className={inp} /></label>
          </div>
          {/* District + Neighborhood — one row */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className={lbl}>{L('الحي', 'District')}
              <select value={f.districtId ?? ''} onChange={(e) => setF((s) => ({ ...s, districtId: e.target.value, neighborhoodId: '' }))} className={inp}>
                <option value="">{L('اختر…', 'Choose…')}</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className={lbl}>{L('المجاورة', 'Neighborhood')}
              <select value={f.neighborhoodId ?? ''} onChange={set('neighborhoodId')} className={inp} disabled={!f.districtId}>
                <option value="">{L('اختر…', 'Choose…')}</option>
                {hoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </label>
          </div>
          {/* Block (optional) + Plot — one row */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className={lbl}>{L('رقم البلوك', 'Block no.')}<input value={f.blockNo ?? ''} onChange={set('blockNo')} className={inp} /></label>
            <label className={lbl}>{L('رقم القطعة', 'Plot no.')}<input value={f.plotNo ?? ''} onChange={set('plotNo')} className={inp} /></label>
          </div>
        </>
      )}

      {/* Price — single row + fair-price note */}
      <div>
        <label className="block text-base font-bold text-navy-800">{L('السعر المطلوب (ج.م)', 'Asking price (EGP)')}<input value={f.requiredPrice ?? ''} onChange={set('requiredPrice')} dir="ltr" className={`mt-1 ${inpHi}`} placeholder="0" /></label>
        <p className="mt-1.5 text-xs text-ink-500">
          {L('سنبيع بالسعر الذي تحدده، لكن السعر العادل يساعد على بيع أرضك بشكل أسرع.', "We'll sell at the price you set, but a fair price helps your land sell faster.")}{' '}
          {policyHref
            ? <a href={policyHref} className="font-medium text-gold-700 underline">{L('برجاء الاطلاع على سياسة التسعير.', 'Please review the pricing policy.')}</a>
            : <span>{L('برجاء الاطلاع على سياسة التسعير أسفل الصفحة.', 'Please review the pricing policy below.')}</span>}
        </p>
      </div>

      <label className={lbl}>{L('تفاصيل أخرى', 'Other details')}<textarea value={f.details ?? ''} onChange={set('details')} rows={3} className={inp} /></label>

      {/* Documents + photos: click / drag & drop / paste, with thumbnails */}
      <div>
        <span className={lbl}>{L('صور الأوراق والمستندات (تبقى خاصة لدى الإدارة)', 'Photos of papers & documents (kept private with the admin)')}</span>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onPaste={onPaste}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-1 flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center text-base font-medium transition-colors ${dragOver ? 'border-gold bg-gold-100 text-gold-800' : 'border-navy-300 bg-navy-50 text-navy-700 hover:bg-navy-100'}`}
        >
          <span className="text-3xl" aria-hidden>📎</span>
          {uploading ? L('جارٍ الرفع…', 'Uploading…') : L('اضغط لاختيار الملفات أو اسحبها هنا أو الصقها', 'Click to choose files, or drag & drop, or paste')}
          <span className="text-xs font-normal opacity-70">{L('صور و PDF و Word و Excel', 'Images, PDF, Word, Excel')}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.xlsx" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        {att.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {att.map((p) => (
              <div key={p.id} className="relative">
                {p.isDoc ? (
                  <a href={p.path} target="_blank" rel="noopener noreferrer" className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-ink-200 bg-navy-50 text-[10px] text-navy-700">
                    <span className="text-lg" aria-hidden>📄</span>
                    <span className="w-14 truncate px-1 text-center">{p.name}</span>
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.path} alt="" className="h-16 w-16 rounded-lg border border-ink-200 object-cover" />
                )}
                <button type="button" onClick={() => setAtt((s) => s.filter((x) => x.id !== p.id))} className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {/* Centered, page-wide submit */}
      <button disabled={pending || uploading} className="w-full rounded-xl bg-gold px-7 py-3.5 text-lg font-bold text-navy-900 disabled:opacity-50">
        {pending ? L('جارٍ الإرسال…', 'Sending…') : L('إرسال الطلب', 'Send request')}
      </button>
      <p className="text-center text-xs text-ink-500">{L('بياناتك ومستنداتك تبقى خاصة ولا تظهر للزوّار.', 'Your data and documents stay private and are never shown to visitors.')}</p>
    </form>
  );
}
