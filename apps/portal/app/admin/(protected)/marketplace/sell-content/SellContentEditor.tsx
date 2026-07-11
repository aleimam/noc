'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@noc/ui';
import type { SellContent } from '@noc/config';
import { saveSellContent } from './actions';

const toLines = (a: string[]) => a.join('\n');
const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const ta = `${inp} font-sans`;

export function SellContentEditor({ initial }: { initial: SellContent }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const [announceTitle, setT] = useState(initial.announceTitle);
  const [announceBody, setB] = useState(initial.announceBody);
  const [policyPageSlug, setSlug] = useState(initial.policyPageSlug ?? '');
  const [services, setServices] = useState(toLines(initial.services));
  const [policy, setPolicy] = useState(toLines(initial.policy));
  const [pricing, setPricing] = useState(initial.pricing.map((p) => `${p.level} | ${p.saleTime}`).join('\n'));
  const [shProof, setShProof] = useState(toLines(initial.requiredSheet.proof));
  const [shLand, setShLand] = useState(toLines(initial.requiredSheet.land));
  const [shPrice, setShPrice] = useState(toLines(initial.requiredSheet.price));
  const [alProof, setAlProof] = useState(toLines(initial.requiredAllocated.proof));
  const [alLand, setAlLand] = useState(toLines(initial.requiredAllocated.land));
  const [alPrice, setAlPrice] = useState(toLines(initial.requiredAllocated.price));

  function save() {
    setSaved(false);
    const content: SellContent = {
      announceTitle: announceTitle.trim(),
      announceBody: announceBody.trim(),
      policyPageSlug: policyPageSlug.trim(),
      services: fromLines(services),
      policy: fromLines(policy),
      pricing: fromLines(pricing).map((line) => {
        const [level, saleTime] = line.split('|');
        return { level: (level ?? '').trim(), saleTime: (saleTime ?? '').trim() };
      }),
      requiredSheet: { proof: fromLines(shProof), land: fromLines(shLand), price: fromLines(shPrice) },
      requiredAllocated: { proof: fromLines(alProof), land: fromLines(alLand), price: fromLines(alPrice) },
    };
    start(async () => {
      const r = await saveSellContent(content);
      if (r.ok) { setSaved(true); router.refresh(); }
      else toast('تعذّر الحفظ / Save failed', 'error');
    });
  }

  const Field = ({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) => (
    <label className="block text-sm">
      {label}{hint && <span className="ms-2 text-xs opacity-50">{hint}</span>}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={ta} />
    </label>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">الإعلان الرئيسي</h2>
        <label className="block text-sm">العنوان<input value={announceTitle} onChange={(e) => setT(e.target.value)} className={inp} /></label>
        <label className="block text-sm">النص<textarea value={announceBody} onChange={(e) => setB(e.target.value)} rows={2} className={ta} /></label>
        <label className="block text-sm">رابط صفحة السياسات (slug من قسم الصفحات)<input dir="ltr" value={policyPageSlug} onChange={(e) => setSlug(e.target.value)} className={inp} placeholder="sell-policy" /><span className="mt-1 block text-xs opacity-50">اتركه فارغاً لعرض السياسات والتسعير داخل صفحة البيع. عند تعبئته يظهر رابط «سياسة البيع والتسعير» ويُشار إليه بجوار حقل السعر.</span></label>
      </section>

      <section className="grid gap-4 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
        <Field label="الخدمات" value={services} onChange={setServices} rows={7} hint="سطر لكل خدمة" />
        <Field label="سياسة البيع" value={policy} onChange={setPolicy} rows={7} hint="سطر لكل بند" />
        <div className="sm:col-span-2">
          <Field label="جدول التسعير" value={pricing} onChange={setPricing} rows={5} hint="كل سطر: سعر العرض | سرعة البيع" />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">المطلوب — أرض في كشف التقنين</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="إثبات الملكية" value={shProof} onChange={setShProof} hint="سطر لكل عنصر" />
          <Field label="معلومات الأرض" value={shLand} onChange={setShLand} hint="سطر لكل عنصر" />
          <Field label="السعر المطلوب" value={shPrice} onChange={setShPrice} hint="سطر لكل عنصر" />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">المطلوب — أرض مخصصة (تخصيص)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="إثبات الملكية" value={alProof} onChange={setAlProof} hint="سطر لكل عنصر" />
          <Field label="معلومات الأرض" value={alLand} onChange={setAlLand} hint="سطر لكل عنصر" />
          <Field label="السعر المطلوب" value={alPrice} onChange={setAlPrice} hint="سطر لكل عنصر" />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
        <a href="https://alsawarey.com/sell" target="_blank" rel="noreferrer" className="text-sm text-accent">معاينة الصفحة ↗</a>
      </div>
    </div>
  );
}
