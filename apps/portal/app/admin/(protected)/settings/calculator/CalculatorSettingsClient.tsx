'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
      }
    });
  }

  return (
    <div className="space-y-7">
      {/* factors */}
      <Section title="معامل المساحة الصافية">
        <Grid>
          <Field label="الحد الفاصل (م²)">
            <Inp value={cfg.factors.threshold} onChange={(v) => patch({ factors: { ...cfg.factors, threshold: num(v) } })} />
          </Field>
          <Field label="المعامل للأقل من الحد">
            <Inp step="0.01" value={cfg.factors.small} onChange={(v) => patch({ factors: { ...cfg.factors, small: num(v) } })} />
          </Field>
          <Field label="المعامل للأكبر/يساوي الحد">
            <Inp step="0.01" value={cfg.factors.big} onChange={(v) => patch({ factors: { ...cfg.factors, big: num(v) } })} />
          </Field>
        </Grid>
      </Section>

      {/* standard areas */}
      <Section title="المساحات القياسية (المخصصة)">
        <p className="mb-2 text-xs opacity-60">افصل بين القيم بفاصلة. القيم الأكبر من أعلى مساحة تُعامَل كما هي بدون تقريب.</p>
        <textarea
          value={areasText}
          onChange={(e) => setAreasText(e.target.value)}
          rows={2}
          dir="ltr"
          className="w-full rounded-md border border-graphite/20 px-3 py-2 text-sm"
        />
      </Section>

      {/* prices */}
      <Section title="الأسعار والرسوم">
        <Grid>
          <Field label="سعر شراء المتر من الجهاز">
            <Inp value={cfg.buyPrice} onChange={(v) => patch({ buyPrice: num(v) })} />
          </Field>
          <Field label="سعر بيع المتر للجهاز">
            <Inp value={cfg.sellPrice} onChange={(v) => patch({ sellPrice: num(v) })} />
          </Field>
          <Field label="مصاريف نقل الملكية / م²">
            <Inp value={cfg.transferRate} onChange={(v) => patch({ transferRate: num(v) })} />
          </Field>
          <Field label="مبلغ ثابت يُضاف لنقل الملكية (جنيه)">
            <Inp step="0.01" value={cfg.transferFlat} onChange={(v) => patch({ transferFlat: num(v) })} />
            <p className="mt-1 text-[11px] leading-relaxed opacity-60">
              حسب أمر الدفع الرسمي: التقديم طبقاً لقرار الوزير 100 + ض14 · رسم إداري 10 + ض1.40 · الشهداء 5 · تنمية الموارد 2 · متابعة بالموبايل 2 · إيصال 0.95 = 135.35 — يظهر للجمهور مدموجًا في بند «مصاريف نقل الملكية» كسطر واحد.
            </p>
          </Field>
          <Field label="نسبة المصاريف الإدارية % (من الترفيق + تكلفة فرق المساحة عند الشراء)">
            <Inp step="0.1" value={cfg.adminPct} onChange={(v) => patch({ adminPct: num(v) })} />
          </Field>
          <Field label="مبلغ إداري ثابت (جنيه) يُضاف لكل الحالات">
            <Inp value={cfg.adminFlat} onChange={(v) => patch({ adminFlat: num(v) })} />
          </Field>
          <Field label="أقصى مساحة للحساب (م²)">
            <Inp value={cfg.maxArea} onChange={(v) => patch({ maxArea: num(v) })} />
          </Field>
        </Grid>
      </Section>

      {/* utility brackets */}
      <Section title="شرائح مصاريف الترفيق (حسب المساحة القياسية)">
        <p className="mb-2 text-xs opacity-60">القاعدة: أكبر من «من» وحتى «إلى». اترك «إلى» فارغًا لشريحة مفتوحة.</p>
        <RowList<UtilityBracket>
          rows={cfg.utilityBrackets}
          onChange={(utilityBrackets) => patch({ utilityBrackets })}
          empty={{ min: 0, max: null, rate: 0 }}
          render={(b, set) => (
            <>
              <Inp small value={b.min} onChange={(v) => set({ ...b, min: num(v) })} placeholder="من" />
              <Inp small value={b.max ?? ''} onChange={(v) => set({ ...b, max: orNull(v) })} placeholder="إلى" />
              <Inp small value={b.rate} onChange={(v) => set({ ...b, rate: num(v) })} placeholder="السعر/م²" />
            </>
          )}
        />
      </Section>

      {/* down payment bands */}
      <Section title="المقدمة قبل القرعة (حسب المساحة الأصلية)">
        <p className="mb-2 text-xs opacity-60">القاعدة: المساحة الأصلية أقل من أو تساوي «حتى». اترك «حتى» فارغًا للشريحة الأخيرة.</p>
        <RowList<DownPaymentBand>
          rows={cfg.downPaymentBands}
          onChange={(downPaymentBands) => patch({ downPaymentBands })}
          empty={{ max: null, amount: 0 }}
          render={(b, set) => (
            <>
              <Inp small value={b.max ?? ''} onChange={(v) => set({ ...b, max: orNull(v) })} placeholder="حتى (م²)" />
              <Inp small value={b.amount} onChange={(v) => set({ ...b, amount: num(v) })} placeholder="المقدمة" />
            </>
          )}
        />
      </Section>

      {/* disclaimer (shown on the image; contacts on the image are fixed) */}
      <Section title="إخلاء المسؤولية (صورة النتيجة)">
        <p className="mb-2 text-xs opacity-60">بيانات التواصل في صورة النتيجة ثابتة: 010 408 10000 · newobour.com.</p>
        <Field label="إخلاء المسؤولية (عربي)">
          <textarea
            value={cfg.disclaimerAr}
            onChange={(e) => patch({ disclaimerAr: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-graphite/20 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="إخلاء المسؤولية (إنجليزي)">
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
          {pending ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        {saved && <span className="text-sm text-green">تم الحفظ ✓</span>}
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
            حذف
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, empty])}
        className="rounded-md border border-dashed border-graphite/30 px-3 py-1.5 text-xs text-accent"
      >
        + إضافة شريحة
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
