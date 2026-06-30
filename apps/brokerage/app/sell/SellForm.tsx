'use client';

import { useState, useTransition } from 'react';
import { compressImage, track } from '@noc/ui';
import { createLandOffer, type OfferInput } from './actions';

type Opt = { id: string; name: string };
type Hood = { id: string; name: string; districtId: string };

const inp = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base';
const lbl = 'block text-sm font-medium text-navy-700';

export function SellForm({ cities, districts, neighborhoods }: { cities: Opt[]; districts: Opt[]; neighborhoods: Hood[] }) {
  const [mode, setMode] = useState<'SHEET' | 'ALLOCATED'>('SHEET');
  const [f, setF] = useState<OfferInput>({ mode: 'SHEET', ownerName: '', phone1: '' });
  const [photos, setPhotos] = useState<{ id: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const hoods = neighborhoods.filter((n) => n.districtId === f.districtId);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', await compressImage(file));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.attachment) setPhotos((p) => [...p, { id: j.attachment.id, path: j.attachment.path }]);
    }
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.ownerName.trim() || !f.phone1.trim()) { setError('أدخل الاسم ورقم الهاتف'); return; }
    setError('');
    start(async () => {
      const r = await createLandOffer({ ...f, mode, attachmentIds: photos.map((p) => p.id) });
      if (r.ok) { track('sell_offer', { mode }); setDone(true); }
      else setError('تعذّر الإرسال، حاول مرة أخرى');
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-success bg-white p-6 text-center">
        <div className="text-xl font-extrabold text-success">تم استلام طلبك بنجاح</div>
        <p className="mt-2 text-ink-600">سيتواصل معك فريق الصواري قريباً لتقييم أرضك والبدء في تسويقها.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-md">
      <div className="flex gap-2">
        {(['SHEET', 'ALLOCATED'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setF((s) => ({ ...s, mode: m })); }}
            className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-bold ${mode === m ? 'border-gold bg-gold-50 text-gold-800' : 'border-ink-200 text-ink-600'}`}>
            {m === 'SHEET' ? 'أرض في كشف التقنين' : 'أرض مخصصة (تخصيص)'}
          </button>
        ))}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className={lbl}>اسم المالك<input value={f.ownerName} onChange={set('ownerName')} className={inp} required /></label>
        <label className={lbl}>رقم الهاتف<input value={f.phone1} onChange={set('phone1')} dir="ltr" className={inp} required /></label>
        <label className={lbl}>رقم هاتف آخر (اختياري)<input value={f.phone2 ?? ''} onChange={set('phone2')} dir="ltr" className={inp} /></label>
        <label className={lbl}>المساحة (م²)<input value={f.area ?? ''} onChange={set('area')} dir="ltr" className={inp} /></label>

        {mode === 'SHEET' ? (
          <label className={lbl}>المدينة
            <select value={f.cityId ?? ''} onChange={set('cityId')} className={inp}>
              <option value="">اختر…</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className={lbl}>المساحة الأصلية (م²)<input value={f.originalArea ?? ''} onChange={set('originalArea')} dir="ltr" className={inp} /></label>
            <label className={lbl}>الحي
              <select value={f.districtId ?? ''} onChange={(e) => setF((s) => ({ ...s, districtId: e.target.value, neighborhoodId: '' }))} className={inp}>
                <option value="">اختر…</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className={lbl}>المجاورة
              <select value={f.neighborhoodId ?? ''} onChange={set('neighborhoodId')} className={inp} disabled={!f.districtId}>
                <option value="">اختر…</option>
                {hoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </label>
            <label className={lbl}>رقم البلوك<input value={f.blockNo ?? ''} onChange={set('blockNo')} className={inp} /></label>
            <label className={lbl}>رقم القطعة<input value={f.plotNo ?? ''} onChange={set('plotNo')} className={inp} /></label>
          </>
        )}

        <label className={lbl}>السعر المطلوب (ج.م)<input value={f.requiredPrice ?? ''} onChange={set('requiredPrice')} dir="ltr" className={inp} /></label>
      </div>

      <label className={lbl}>تفاصيل أخرى<textarea value={f.details ?? ''} onChange={set('details')} rows={3} className={inp} /></label>

      <div>
        <span className={lbl}>صور الأوراق والمستندات (تبقى خاصة لدى الإدارة)</span>
        <input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} className="mt-1 block w-full text-sm" />
        {uploading && <p className="mt-1 text-xs text-ink-500">جارٍ الرفع…</p>}
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.path} alt="" className="h-16 w-16 rounded-lg border border-ink-200 object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending || uploading} className="rounded-xl bg-gold px-7 py-3 font-bold text-navy-900 disabled:opacity-50">
          {pending ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <p className="text-xs text-ink-500">بياناتك ومستنداتك تبقى خاصة ولا تظهر للزوّار.</p>
    </form>
  );
}
