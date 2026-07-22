'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from '@noc/ui';
import type { CalculatorConfig, UtilityBracket, DownPaymentBand } from '../../../../../lib/calculator/calc';
import { saveCalcSettings } from './actions';

const num = (v: string) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
};
const orNull = (v: string) => {
  const t = v.trim();
  if (t === '') return null;
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
};

export function CalculatorSettingsClient({ initial }: { initial: CalculatorConfig }) {
  const router = useRouter();
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [cfg, setCfg] = useState<CalculatorConfig>(initial);
  const [areasText, setAreasText] = useState(initial.standardAreas.join('، '));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const patch = (p: Partial<CalculatorConfig>) => setCfg((c) => ({ ...c, ...p }));

  function save() {
    setSaved(false);
    const standardAreas = areasText
      .split(/[،,\s]+/)
      .map((s) => parseFloat(s))
      .filter((n) => isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    const clean: CalculatorConfig = { ...cfg, standardAreas };
    start(async () => {
      const r = await saveCalcSettings(clean);
      if (r.ok) {
        setCfg(clean);
        setAreasText(standardAreas.join('، '));
        setSaved(true);
        router.refresh();
      } else {
        toast(L('تعذّر الحفظ', 'Save failed'), 'error');
      }
    });
  }

  return (
    <div className="space-y-7">
      {/* factors */}
      <Section title={L('معامل المساحة الصافية', 'Net-area factor')}>
        <Grid>
          <Field label={L('الحد الفاصل (م²)', 'Threshold (m²)')}>
            <Inp value={cfg.factors.threshold} onChange={(v) => patch({ factors: { ...cfg.factors, threshold: num(v) } })} />
          </Field>
          <Field label={L('المعامل للأقل من الحد', 'Factor below the threshold')}>
            <Inp step="0.01" value={cfg.factors.small} onChange={(v) => patch({ factors: { ...cfg.factors, small: num(v) } })} />
          </Field>
          <Field label={L('المعامل للأكبر/يساوي الحد', 'Factor at or above the threshold')}>
            <Inp step="0.01" value={cfg.factors.big} onChange={(v) => patch({ factors: { ...cfg.factors, big: num(v) } })} />
          </Field>
        </Grid>
      </Section>

      {/* standard areas */}
      <Section title={L('المساحات القياسية (المخصصة)', 'Standard (allocated) areas')}>
        <p className="mb-2 text-xs opacity-60">{L('افصل بين القيم بفاصلة. القيم الأكبر من أعلى مساحة تُعامَل كما هي بدون تقريب.', 'Separate the values with a comma. Values larger than the biggest area are used as-is, with no rounding.')}</p>
        <textarea
          value={areasText}
          onChange={(e) => setAreasText(e.target.value)}
          rows={2}
          dir="ltr"
          className="w-full rounded-md border border-graphite/20 px-3 py-2 text-sm"
        />
      </Section>

      {/* prices */}
      <Section title={L('الأسعار والرسوم', 'Prices and fees')}>
        <Grid>
          <Field label={L('سعر شراء المتر من الجهاز', 'Price per m² bought from the Authority')}>
            <Inp value={cfg.buyPrice} onChange={(v) => patch({ buyPrice: num(v) })} />
          </Field>
          <Field label={L('سعر بيع المتر للجهاز', 'Price per m² sold to the Authority')}>
            <Inp value={cfg.sellPrice} onChange={(v) => patch({ sellPrice: num(v) })} />
          </Field>
          <Field label={L('مصاريف نقل الملكية / م²', 'Ownership-transfer fee / m²')}>
            <Inp value={cfg.transferRate} onChange={(v) => patch({ transferRate: num(v) })} />
          </Field>
          <Field label={L('مبلغ ثابت يُضاف لنقل الملكية (جنيه)', 'Flat amount added to the transfer (EGP)')}>
            <Inp step="0.01" value={cfg.transferFlat} onChange={(v) => patch({ transferFlat: num(v) })} />
            <p className="mt-1 text-[11px] leading-relaxed opacity-60">
              {L('حسب أمر الدفع الرسمي: التقديم طبقاً لقرار الوزير 100 + ض14 · رسم إداري 10 + ض1.40 · الشهداء 5 · تنمية الموارد 2 · متابعة بالموبايل 2 · إيصال 0.95 = 135.35 — يظهر للجمهور مدموجًا في بند «مصاريف نقل الملكية» كسطر واحد.', 'Per the official payment order: application under the Minister’s decree 100 + 14 tax · administrative fee 10 + 1.40 tax · Martyrs 5 · resource development 2 · mobile follow-up 2 · receipt 0.95 = 135.35 — shown to the public merged into the “ownership-transfer fee” as a single line.')}
            </p>
          </Field>
          <Field label={L('نسبة المصاريف الإدارية % (من الترفيق + تكلفة فرق المساحة عند الشراء)', 'Administrative fee % (of utilities + the area-difference cost when buying)')}>
            <Inp step="0.1" value={cfg.adminPct} onChange={(v) => patch({ adminPct: num(v) })} />
          </Field>
          <Field label={L('مبلغ إداري ثابت (جنيه) يُضاف لكل الحالات', 'Flat administrative amount (EGP) added in every case')}>
            <Inp value={cfg.adminFlat} onChange={(v) => patch({ adminFlat: num(v) })} />
          </Field>
          <Field label={L('أقصى مساحة للحساب (م²)', 'Maximum area for the calculation (m²)')}>
            <Inp value={cfg.maxArea} onChange={(v) => patch({ maxArea: num(v) })} />
          </Field>
        </Grid>
      </Section>

      {/* utility brackets */}
      <Section title={L('شرائح مصاريف الترفيق (حسب المساحة القياسية)', 'Utility-fee brackets (by standard area)')}>
        <p className="mb-2 text-xs opacity-60">{L('القاعدة: أكبر من «من» وحتى «إلى». اترك «إلى» فارغًا لشريحة مفتوحة.', 'Rule: greater than “From” and up to “To”. Leave “To” empty for an open-ended bracket.')}</p>
        <RowList<UtilityBracket>
          rows={cfg.utilityBrackets}
          onChange={(utilityBrackets) => patch({ utilityBrackets })}
          empty={{ min: 0, max: null, rate: 0 }}
          render={(b, set) => (
            <>
              <Inp small value={b.min} onChange={(v) => set({ ...b, min: num(v) })} placeholder={L('من', 'From')} />
              <Inp small value={b.max ?? ''} onChange={(v) => set({ ...b, max: orNull(v) })} placeholder={L('إلى', 'To')} />
              <Inp small value={b.rate} onChange={(v) => set({ ...b, rate: num(v) })} placeholder={L('السعر/م²', 'Price/m²')} />
            </>
          )}
        />
      </Section>

      {/* down payment bands */}
      <Section title={L('المقدمة قبل القرعة (حسب المساحة الأصلية)', 'Down payment before the draw (by original area)')}>
        <p className="mb-2 text-xs opacity-60">{L('القاعدة: المساحة الأصلية أقل من أو تساوي «حتى». اترك «حتى» فارغًا للشريحة الأخيرة.', 'Rule: original area less than or equal to “Up to”. Leave “Up to” empty for the last band.')}</p>
        <RowList<DownPaymentBand>
          rows={cfg.downPaymentBands}
          onChange={(downPaymentBands) => patch({ downPaymentBands })}
          empty={{ max: null, amount: 0 }}
          render={(b, set) => (
            <>
              <Inp small value={b.max ?? ''} onChange={(v) => set({ ...b, max: orNull(v) })} placeholder={L('حتى (م²)', 'Up to (m²)')} />
              <Inp small value={b.amount} onChange={(v) => set({ ...b, amount: num(v) })} placeholder={L('المقدمة', 'Down payment')} />
            </>
          )}
        />
      </Section>

      {/* disclaimer (shown on the image; contacts on the image are fixed) */}
      <Section title={L('إخلاء المسؤولية (صورة النتيجة)', 'Disclaimer (result image)')}>
        <p className="mb-2 text-xs opacity-60">{L('بيانات التواصل في صورة النتيجة ثابتة: 010 408 10000 · newobour.com.', 'Contact details on the result image are fixed: 010 408 10000 · newobour.com.')}</p>
        <Field label={L('إخلاء المسؤولية (عربي)', 'Disclaimer (Arabic)')}>
          <textarea
            value={cfg.disclaimerAr}
            onChange={(e) => patch({ disclaimerAr: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-graphite/20 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={L('إخلاء المسؤولية (إنجليزي)', 'Disclaimer (English)')}>
          <textarea
            value={cfg.disclaimerEn}
            onChange={(e) => patch({ disclaimerEn: e.target.value })}
            rows={2}
            dir="ltr"
            className="w-full rounded-md border border-graphite/20 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={save} className="rounded-md bg-primary px-6 py-2.5 text-sm text-soft disabled:opacity-50">
          {pending ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}
        </button>
        {saved && <span className="text-sm text-green">{L('تم الحفظ ✓', 'Saved ✓')}</span>}
      </div>
    </div>
  );
}

/* ---- generic editable row list ---- */
function RowList<T>({
  rows,
  onChange,
  empty,
  render,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  render: (row: T, set: (next: T) => void) => React.ReactNode;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {render(row, (next) => onChange(rows.map((r, j) => (j === i ? next : r))))}
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="rounded-md border border-graphite/20 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            {L('حذف', 'Delete')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, empty])}
        className="rounded-md border border-dashed border-graphite/30 px-3 py-1.5 text-xs text-accent"
      >
        {L('+ إضافة شريحة', '+ Add bracket')}
      </button>
    </div>
  );
}

/* ---- small UI ---- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-graphite/15 p-4">
      <h2 className="mb-3 font-semibold text-primary">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium opacity-70">{label}</span>
      {children}
    </label>
  );
}
function Inp({
  value,
  onChange,
  step,
  text,
  small,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  step?: string;
  text?: boolean;
  small?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={text ? 'text' : 'number'}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      dir={text ? undefined : 'ltr'}
      className={`rounded-md border border-graphite/20 px-3 py-2 text-sm ${small ? 'w-28' : 'w-full'}`}
    />
  );
}
