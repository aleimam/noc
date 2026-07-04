'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { pick } from '@noc/i18n';
import { netArea, deriveStandard, reconcile, type CalculatorConfig, type ReconcileResult } from '../../lib/calculator/calc';

type Tab = 'area' | 'reconcile';

export function CalculatorClient({ config, locale }: { config: CalculatorConfig; locale: 'ar' | 'en' }) {
  const t = useTranslations('calculator');
  const [tab, setTab] = useState<Tab>('area');

  return (
    <div className="space-y-6">
      <div className="flex rounded-2xl bg-white p-1 shadow-md">
        {(['area', 'reconcile'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key ? 'bg-navy-800 text-white shadow' : 'text-navy-700 hover:bg-navy-50'
            }`}
          >
            {t(key === 'area' ? 'tabArea' : 'tabReconcile')}
          </button>
        ))}
      </div>

      {tab === 'area' ? <AreaCalc config={config} /> : <ReconcileCalc config={config} locale={locale} />}
    </div>
  );
}

/* ---------------- Area calculator ---------------- */

function AreaCalc({ config }: { config: CalculatorConfig }) {
  const t = useTranslations('calculator');
  const [original, setOriginal] = useState('');
  const orig = parseFloat(original);
  const ready = isFinite(orig) && orig > 0;
  const net = ready ? netArea(orig, config) : null;
  const standard = net !== null ? deriveStandard(net, config) : null;

  return (
    <div className="space-y-5 rounded-2xl bg-white p-5 shadow-md sm:p-6">
      <div>
        <h2 className="text-xl font-black text-navy-800">{t('areaTitle')}</h2>
        <p className="mt-1 text-sm text-ink-600">{t('areaHint')}</p>
      </div>
      <NumberField label={t('originalArea')} value={original} onChange={setOriginal} />
      {net !== null && standard !== null && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-navy-50 p-4 text-center">
              <div className="text-sm text-ink-600">{t('originalArea')}</div>
              <div className="font-num mt-1 text-2xl font-black text-navy-800" dir="ltr">{fmtArea(orig)}</div>
            </div>
            <div className="rounded-2xl bg-navy-50 p-4 text-center">
              <div className="text-sm text-ink-600">{t('discountedArea')}</div>
              <div className="font-num mt-1 text-2xl font-black text-navy-800" dir="ltr">{fmtArea(net)}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-navy-800 p-6 text-center text-white">
            <div className="text-base text-navy-200">{t('standardArea')}</div>
            <div className="font-num mt-1 text-5xl font-black text-gold sm:text-6xl" dir="ltr">
              {fmtArea(standard)} <span className="text-2xl">{t('meters')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Reconciliation calculator ---------------- */

function ReconcileCalc({ config, locale }: { config: CalculatorConfig; locale: 'ar' | 'en' }) {
  const t = useTranslations('calculator');
  const [original, setOriginal] = useState('');
  const [standard, setStandard] = useState('');
  const [standardEdited, setStandardEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  const orig = parseFloat(original);
  const net = isFinite(orig) && orig > 0 ? netArea(orig, config) : null;

  // The standard the owner receives defaults to the nearest standard to the
  // after-deduction area; the chips / manual entry override it.
  function onOriginal(v: string) {
    setOriginal(v);
    if (!standardEdited) {
      const o = parseFloat(v);
      const nt = isFinite(o) && o > 0 ? netArea(o, config) : NaN;
      setStandard(isFinite(nt) ? String(deriveStandard(nt, config)) : '');
    }
  }
  function setStandardManual(v: string) {
    setStandardEdited(true);
    setStandard(v);
  }

  const std = parseFloat(standard);
  const ready = isFinite(orig) && orig > 0 && isFinite(std) && std > 0;

  const result: ReconcileResult | null = useMemo(
    () => (ready ? reconcile(orig, std, config) : null),
    [ready, orig, std, config],
  );

  async function download() {
    if (!result || result.overMax) return;
    setBusy(true);
    try {
      const url = await renderStatement(result, config, locale, (k, v) => t(k, v));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reconciliation.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number) => `${fmtNum(n)} ${t('egp')}`;

  return (
    <div className="space-y-5">
      <div className="space-y-5 rounded-2xl bg-white p-5 shadow-md sm:p-6">
        <div>
          <h2 className="text-xl font-black text-navy-800">{t('reconcileTitle')}</h2>
          <p className="mt-1 text-sm text-ink-600">{t('reconcileHint')}</p>
        </div>
        <NumberField label={t('originalArea')} value={original} onChange={onOriginal} />
        {net !== null && (
          <div className="rounded-xl bg-navy-50 px-4 py-3">
            <span className="text-sm text-ink-600">{t('discountedArea')}: </span>
            <span className="font-num text-xl font-bold text-navy-800" dir="ltr">{fmtArea(net)} {t('meters')}</span>
          </div>
        )}
        <div>
          <NumberField label={t('standardReceived')} value={standard} onChange={setStandardManual} hint={t('standardHint')} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {config.standardAreas.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStandardManual(String(s))}
                className={`font-num rounded-lg border px-3 py-1 text-sm transition ${
                  std === s ? 'border-gold bg-gold-50 text-gold-800' : 'border-ink-200 text-navy-700 hover:border-gold'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!result && <p className="py-8 text-center text-ink-500">{t('enterValues')}</p>}

      {result && result.overMax && (
        <div className="rounded-2xl border border-gold/40 bg-gold-50 p-5 text-center text-navy-800">
          {t('overMax', { max: result.maxArea })}
        </div>
      )}

      {result && !result.overMax && (
        <div className="space-y-4">
          {/* summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label={t('discountedArea')} value={`${fmtArea(result.afterDeduction)} ${t('meters')}`} />
            <SummaryCard label={t('standardArea')} value={`${fmtArea(result.standard)} ${t('meters')}`} />
            <SummaryCard
              label={t('areaDiff')}
              value={
                result.mode === 'exact'
                  ? t('exact')
                  : `${t(result.mode)} · ${fmtArea(result.tradedArea)} ${t('meters')}`
              }
            />
            <SummaryCard label={t('grandTotal')} value={money(result.grandTotal)} highlight />
          </div>

          {/* cost breakdown */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <Row label={t('areaDiffCost')} value={money(result.areaDiffCost)} />
            <Row label={t('utilities')} value={money(result.utilities)} />
            <Row label={t('adminFee', { pct: config.adminPct })} value={money(result.adminFeePct)} />
            <Row label={t('adminFeeFlat')} value={money(result.adminFeeFlat)} />
            <Row label={t('totalCost')} value={money(result.total)} strong />
          </div>

          {/* payment plan */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <PhaseHeader>{t('phaseBefore')}</PhaseHeader>
            <Row label={t('downPayment')} value={money(result.downPayment)} />
            <PhaseHeader>{t('phaseAfter')}</PhaseHeader>
            <Row label={t('estekmal')} value={money(result.estekmal)} />
            <Row label={t('transferFee')} value={money(result.transferFee)} />
            <PhaseHeader>{t('phaseYears')}</PhaseHeader>
            <Row label={`${t('installment1')} · ${t('year1')}`} value={money(result.installments[0])} />
            <Row label={`${t('installment2')} · ${t('year2')}`} value={money(result.installments[1])} />
            <Row label={`${t('installment3')} · ${t('year3')}`} value={money(result.installments[2])} />
          </div>

          <button
            onClick={download}
            disabled={busy}
            className="w-full rounded-xl bg-gold px-6 py-3 font-bold text-navy-900 shadow-gold transition hover:brightness-95 disabled:opacity-50"
          >
            {busy ? t('preparing') : `⬇ ${t('downloadImage')}`}
          </button>

          <p className="px-1 text-center text-xs text-ink-400">{pick(config.disclaimerAr, config.disclaimerEn, locale)}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- small UI bits ---------------- */

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-navy-800">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-num mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-lg text-navy-800 outline-none focus:border-gold"
        dir="ltr"
      />
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? 'bg-navy-800 text-white' : 'bg-white shadow-sm'}`}>
      <div className={`text-xs ${highlight ? 'text-navy-200' : 'text-ink-500'}`}>{label}</div>
      <div className={`font-num mt-1 text-lg font-black ${highlight ? 'text-gold' : 'text-navy-800'}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${strong ? 'border-t border-ink-200' : ''}`}>
      <span className={`text-sm ${strong ? 'font-bold text-navy-800' : 'text-ink-700'}`}>{label}</span>
      <span className={`font-num text-sm ${strong ? 'font-black text-navy-800' : 'font-semibold text-navy-700'}`} dir="ltr">
        {value}
      </span>
    </div>
  );
}

function PhaseHeader({ children }: { children: React.ReactNode }) {
  return <div className="bg-navy-50 px-4 py-2 text-xs font-bold text-navy-700">{children}</div>;
}

/* ---------------- number formatting ---------------- */

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
function fmtArea(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-US');
}

/* ---------------- downloadable statement (canvas) ---------------- */

type Success = Extract<ReconcileResult, { overMax: false }>;

async function renderStatement(
  r: Success,
  cfg: CalculatorConfig,
  locale: 'ar' | 'en',
  t: (key: string, values?: Record<string, string | number>) => string,
): Promise<string> {
  const rtl = locale !== 'en';
  const W = 760;
  const M = 40; // margin
  const scale = 2;

  // load logo (same-origin, won't taint canvas)
  const logo = await loadImage('/brand/logo').catch(() => null);
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignore */
  }

  const egp = t('egp');
  const money = (n: number) => `${fmtNum(n)} ${egp}`;
  const area = (n: number) => `${fmtArea(n)} ${t('meters')}`;

  type Line =
    | { kind: 'section'; text: string }
    | { kind: 'phase'; text: string }
    | { kind: 'row'; label: string; value: string; strong?: boolean };

  const lines: Line[] = [
    { kind: 'section', text: t('imageInputs') },
    { kind: 'row', label: t('originalArea'), value: area(r.originalArea) },
    { kind: 'row', label: t('discountedArea'), value: area(r.afterDeduction) },
    { kind: 'row', label: t('standardArea'), value: area(r.standard) },
    {
      kind: 'row',
      label: t('areaDiff'),
      value: r.mode === 'exact' ? t('exact') : `${t(r.mode)} · ${area(r.tradedArea)}`,
    },
    { kind: 'section', text: t('imageResults') },
    { kind: 'row', label: t('areaDiffCost'), value: money(r.areaDiffCost) },
    { kind: 'row', label: t('utilities'), value: money(r.utilities) },
    { kind: 'row', label: t('adminFee', { pct: cfg.adminPct }), value: money(r.adminFeePct) },
    { kind: 'row', label: t('adminFeeFlat'), value: money(r.adminFeeFlat) },
    { kind: 'row', label: t('totalCost'), value: money(r.total), strong: true },
    { kind: 'phase', text: t('phaseBefore') },
    { kind: 'row', label: t('downPayment'), value: money(r.downPayment) },
    { kind: 'phase', text: t('phaseAfter') },
    { kind: 'row', label: t('estekmal'), value: money(r.estekmal) },
    { kind: 'row', label: t('transferFee'), value: money(r.transferFee) },
    { kind: 'phase', text: t('phaseYears') },
    { kind: 'row', label: `${t('installment1')} · ${t('year1')}`, value: money(r.installments[0]) },
    { kind: 'row', label: `${t('installment2')} · ${t('year2')}`, value: money(r.installments[1]) },
    { kind: 'row', label: `${t('installment3')} · ${t('year3')}`, value: money(r.installments[2]) },
    { kind: 'row', label: t('grandTotal'), value: money(r.grandTotal), strong: true },
  ];

  // measure height
  const headerH = 96;
  const rowH = 34;
  const sectionH = 38;
  const phaseH = 30;
  let bodyH = 16;
  for (const l of lines) bodyH += l.kind === 'row' ? rowH : l.kind === 'phase' ? phaseH : sectionH;
  const footerH = 96;
  const H = headerH + bodyH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  if ('direction' in ctx) ctx.direction = rtl ? 'rtl' : 'ltr';

  const NAVY = '#0b1b33';
  const GOLD = '#c9983e';
  const INK = '#1f2937';
  const MUTE = '#6b7280';
  const LINE = '#e5e7eb';
  const NAVY50 = '#eef1f6';

  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, headerH);
  const startX = rtl ? W - M : M;
  const endX = rtl ? M : W - M;
  if (logo) {
    const lw = 56;
    const lh = (logo.height / logo.width) * lw || lw;
    const lx = rtl ? W - M - lw : M;
    ctx.drawImage(logo, lx, (headerH - lh) / 2, lw, lh);
  }
  ctx.textAlign = rtl ? 'right' : 'left';
  const titleX = rtl ? W - M - (logo ? 70 : 0) : M + (logo ? 70 : 0);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 26px Tajawal, Arial, sans-serif';
  ctx.fillText(locale === 'en' ? 'New Obour' : 'العبور الجديد', titleX, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Tajawal, Arial, sans-serif';
  ctx.fillText(t('imageTitle'), titleX, 66);

  // body rows
  let y = headerH + 16;
  for (const l of lines) {
    if (l.kind === 'section') {
      ctx.fillStyle = NAVY;
      ctx.font = 'bold 17px Tajawal, Arial, sans-serif';
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillText(l.text, startX, y + sectionH / 2);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(M, y + sectionH - 4);
      ctx.lineTo(W - M, y + sectionH - 4);
      ctx.stroke();
      y += sectionH;
    } else if (l.kind === 'phase') {
      ctx.fillStyle = NAVY50;
      ctx.fillRect(M, y, W - 2 * M, phaseH);
      ctx.fillStyle = NAVY;
      ctx.font = 'bold 13px Tajawal, Arial, sans-serif';
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillText(l.text, startX - (rtl ? 10 : -10), y + phaseH / 2);
      y += phaseH;
    } else {
      ctx.fillStyle = l.strong ? NAVY : INK;
      ctx.font = `${l.strong ? 'bold ' : ''}15px Tajawal, Arial, sans-serif`;
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillText(l.label, startX, y + rowH / 2);
      ctx.fillStyle = l.strong ? NAVY : '#374151';
      ctx.font = `${l.strong ? 'bold ' : ''}15px Arial, sans-serif`;
      ctx.textAlign = rtl ? 'left' : 'right';
      ctx.fillText(l.value, endX, y + rowH / 2);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M, y + rowH);
      ctx.lineTo(W - M, y + rowH);
      ctx.stroke();
      y += rowH;
    }
  }

  // footer — fixed New Obour contacts, brand colors + icons (not admin-editable)
  const fy = H - footerH;
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, fy, W, footerH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, fy, W, 3);
  ctx.textAlign = 'center';
  if ('direction' in ctx) ctx.direction = 'ltr';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Tajawal, Arial, sans-serif';
  ctx.fillText('📞  010 408 10000        🌐  newobour.com', W / 2, fy + 32);
  if ('direction' in ctx) ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.fillStyle = '#9aa6b8';
  ctx.font = '12px Tajawal, Arial, sans-serif';
  const disc = pick(cfg.disclaimerAr, cfg.disclaimerEn, locale);
  ctx.fillText(truncate(disc, 95), W / 2, fy + 62);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
