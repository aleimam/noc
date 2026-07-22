'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from '@noc/ui';
import type { SellContent } from '@noc/config';
import { saveSellContent } from './actions';

const toLines = (a: string[]) => a.join('\n');
const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const inp = 'w-full rounded-md border border-graphite/20 bg-transparent px-3 py-2 text-sm';
const ta = `${inp} font-sans`;

export function SellContentEditor({ initial }: { initial: SellContent }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
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
      else toast(L('تعذّر الحفظ', 'Save failed'), 'error');
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
        <h2 className="font-semibold text-primary">{L('الإعلان الرئيسي', 'Main announcement')}</h2>
        <label className="block text-sm">{L('العنوان', 'Title')}<input value={announceTitle} onChange={(e) => setT(e.target.value)} className={inp} /></label>
        <label className="block text-sm">{L('النص', 'Body')}<textarea value={announceBody} onChange={(e) => setB(e.target.value)} rows={2} className={ta} /></label>
        <label className="block text-sm">{L('رابط صفحة السياسات (slug من قسم الصفحات)', 'Policy page link (slug from the Pages section)')}<input dir="ltr" value={policyPageSlug} onChange={(e) => setSlug(e.target.value)} className={inp} placeholder="sell-policy" /><span className="mt-1 block text-xs opacity-50">{L('اتركه فارغاً لعرض السياسات والتسعير داخل صفحة البيع. عند تعبئته يظهر رابط «سياسة البيع والتسعير» ويُشار إليه بجوار حقل السعر.', 'Leave empty to show the policy and pricing inside the sell page. When filled, a “sale policy and pricing” link appears and is referenced next to the price field.')}</span></label>
      </section>

      <section className="grid gap-4 rounded-lg border border-graphite/15 p-4 sm:grid-cols-2">
        <Field label={L('الخدمات', 'Services')} value={services} onChange={setServices} rows={7} hint={L('سطر لكل خدمة', 'One line per service')} />
        <Field label={L('سياسة البيع', 'Sale policy')} value={policy} onChange={setPolicy} rows={7} hint={L('سطر لكل بند', 'One line per item')} />
        <div className="sm:col-span-2">
          <Field label={L('جدول التسعير', 'Pricing table')} value={pricing} onChange={setPricing} rows={5} hint={L('كل سطر: سعر العرض | سرعة البيع', 'Each line: asking price | selling speed')} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('المطلوب — أرض في كشف التقنين', 'Required — land on a rationing sheet')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={L('إثبات الملكية', 'Proof of ownership')} value={shProof} onChange={setShProof} hint={L('سطر لكل عنصر', 'One line per item')} />
          <Field label={L('معلومات الأرض', 'Land information')} value={shLand} onChange={setShLand} hint={L('سطر لكل عنصر', 'One line per item')} />
          <Field label={L('السعر المطلوب', 'Asking price')} value={shPrice} onChange={setShPrice} hint={L('سطر لكل عنصر', 'One line per item')} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{L('المطلوب — أرض مخصصة (تخصيص)', 'Required — allocated land')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={L('إثبات الملكية', 'Proof of ownership')} value={alProof} onChange={setAlProof} hint={L('سطر لكل عنصر', 'One line per item')} />
          <Field label={L('معلومات الأرض', 'Land information')} value={alLand} onChange={setAlLand} hint={L('سطر لكل عنصر', 'One line per item')} />
          <Field label={L('السعر المطلوب', 'Asking price')} value={alPrice} onChange={setAlPrice} hint={L('سطر لكل عنصر', 'One line per item')} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-soft disabled:opacity-50">{pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
        <a href="https://alsawarey.com/sell" target="_blank" rel="noreferrer" className="text-sm text-accent">{L('معاينة الصفحة ↗', 'Preview the page ↗')}</a>
      </div>
    </div>
  );
}
