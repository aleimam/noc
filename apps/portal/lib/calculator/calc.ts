// Pure calculation logic for the Calculator module — no server-only imports, so it can
// run on the client for instant feedback. The admin-editable config (config.ts) loads
// these defaults from Setting('calculator.config') and passes a CalculatorConfig in.
//
// Two independent tools:
//   1. Area Calculator      — Original Area → Net Area (0.85 / 0.80 factor).
//   2. Reconciliation/Payment — Original Area (down-payment band only) + Actual Area
//      (picked from the standard list or entered free) → full reconciliation breakdown.

export type UtilityBracket = { min: number; max: number | null; rate: number }; // min < standard <= max (max null = open)
export type DownPaymentBand = { max: number | null; amount: number }; // original <= max (max null = open)

export type CalculatorConfig = {
  /** Net-area factors: original < threshold → small, otherwise → big. */
  factors: { threshold: number; small: number; big: number };
  /** Admin-defined standard (allocated) areas, ascending. */
  standardAreas: number[];
  /** Utility (الترفيق) rate per m², by standard-area bracket. */
  utilityBrackets: UtilityBracket[];
  buyPrice: number; // EGP/m² the owner pays to buy the shortfall from the Authority
  sellPrice: number; // EGP/m² the owner receives selling the surplus
  transferRate: number; // مصاريف نقل الملكية per m² of standard area
  adminPct: number; // % admin fee on (utilities + area-difference BUY cost); charged once, in settlement 1
  adminFlat: number; // flat EGP added to the admin fee for every calculation, all areas
  downPaymentBands: DownPaymentBand[]; // pre-allocation down payment, by ORIGINAL area
  maxArea: number; // above this → no calculation (contact us)
  /** Shown on the downloadable image. */
  contact: { phone: string; whatsapp: string; address: string };
  disclaimerAr: string;
  disclaimerEn: string;
};

export const DEFAULT_CALC_CONFIG: CalculatorConfig = {
  factors: { threshold: 500, small: 0.85, big: 0.8 },
  standardAreas: [209, 276, 350, 400, 450, 500, 624, 682, 792],
  utilityBrackets: [
    { min: 0, max: 300, rate: 1200 }, // 209, 276
    { min: 300, max: 500, rate: 1400 }, // 350, 400, 450, 500
    { min: 500, max: 1000, rate: 1750 }, // 624, 682, 792 …up to 1000
    { min: 1000, max: 4200, rate: 1500 }, // >1000 up to 4200
  ],
  buyPrice: 3000,
  sellPrice: 750,
  transferRate: 330,
  adminPct: 1.5,
  adminFlat: 1500,
  downPaymentBands: [
    { max: 300, amount: 60000 },
    { max: 500, amount: 100000 },
    { max: null, amount: 150000 },
  ],
  maxArea: 4200,
  contact: { phone: '', whatsapp: '', address: '' },
  disclaimerAr:
    'هذه القيم تقديرية للاسترشاد فقط وليست بيانًا رسميًا من جهاز مدينة العبور الجديدة. رجاء زيارة جهاز المدينة للحصول على القيم الفعلية الدقيقة للمدفوعات المطلوبة.',
  disclaimerEn:
    'These figures are indicative estimates only and are not an official statement from the New Obour City Authority. Please visit the City Authority for the exact, official payment values.',
};

/** Net area from the original area (Area Calculator). */
export function netArea(original: number, cfg: CalculatorConfig): number {
  if (!isFinite(original) || original <= 0) return 0;
  const f = original < cfg.factors.threshold ? cfg.factors.small : cfg.factors.big;
  return original * f;
}

function nearestStandard(area: number, standards: number[]): number {
  let best = standards[0] ?? area;
  let bestD = Math.abs(area - best);
  for (const s of standards) {
    const d = Math.abs(area - s);
    // tie → prefer the larger standard (round up)
    if (d < bestD || (d === bestD && s > best)) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Allocated/standard area for a given actual area: nearest standard, or the actual
 *  area itself when it is larger than every defined standard (large plots). */
export function deriveStandard(actual: number, cfg: CalculatorConfig): number {
  const stds = [...cfg.standardAreas].sort((a, b) => a - b);
  if (stds.length === 0) return actual;
  const max = stds[stds.length - 1]!;
  if (actual > max) return actual;
  return nearestStandard(actual, stds);
}

function bracketRate(standard: number, brackets: UtilityBracket[]): number {
  for (const b of brackets) {
    const underMax = b.max === null ? true : standard <= b.max;
    if (standard > b.min && underMax) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

function downPayment(original: number, bands: DownPaymentBand[]): number {
  for (const b of bands) {
    if (b.max === null || original <= b.max) return b.amount;
  }
  return bands[bands.length - 1]?.amount ?? 0;
}

const round = (n: number) => Math.round(n);

export type ReconcileResult =
  | { overMax: true; maxArea: number }
  | {
      overMax: false;
      originalArea: number;
      afterDeduction: number; // 0.85/0.80 × original — the calc baseline
      standard: number;
      /** standard − actual: >0 buy shortfall, <0 sell surplus, 0 exact. */
      areaDelta: number;
      mode: 'buy' | 'sell' | 'exact';
      tradedArea: number; // meters bought or sold (absolute)
      areaDiffCost: number; // +buy cost / −sell credit
      utilityRate: number;
      utilityBase: number; // meters utilities are charged on
      utilities: number;
      adminFeePct: number; // the % part: adminPct × (utilities + buy cost)
      adminFeeFlat: number; // the flat EGP part
      adminFee: number; // adminFeePct + adminFeeFlat (used in the payment schedule)
      total: number; // areaDiffCost + utilities (financed over 4 settlements)
      downPayment: number; // paid before allocation
      estekmal: number; // الاستكمال — remainder of settlement 1 after the down payment
      transferFee: number; // مصاريف نقل الملكية (one-time)
      installments: [number, number, number]; // القسط الأول/الثاني/الثالث
      grandTotal: number; // everything the owner pays in total
    };

export function reconcile(originalArea: number, standardArea: number | null, cfg: CalculatorConfig): ReconcileResult {
  // Area after deduction (0.85/0.80 × original) — always computed and used in the math;
  // the owner is "entitled" to this. It is never replaced by the standard.
  const afterDeduction = netArea(originalArea, cfg);
  // Standard plot the owner actually receives: the chosen standard, or — if none chosen —
  // the nearest standard to the after-deduction area.
  const standard = standardArea && standardArea > 0 ? standardArea : deriveStandard(afterDeduction, cfg);
  if (originalArea > cfg.maxArea || standard > cfg.maxArea) {
    return { overMax: true, maxArea: cfg.maxArea };
  }

  const areaDelta = standard - afterDeduction;

  let mode: 'buy' | 'sell' | 'exact';
  let purchased = 0;
  let areaDiffCost = 0;
  let utilityBase: number;

  if (areaDelta > 0) {
    mode = 'buy';
    purchased = areaDelta;
    areaDiffCost = purchased * cfg.buyPrice;
    utilityBase = standard - purchased; // = after-deduction area
  } else if (areaDelta < 0) {
    mode = 'sell';
    const surplus = -areaDelta;
    areaDiffCost = -(surplus * cfg.sellPrice); // credit
    utilityBase = standard; // purchased = 0
  } else {
    mode = 'exact';
    utilityBase = standard;
  }

  const utilityRate = bracketRate(standard, cfg.utilityBrackets);
  const utilities = utilityRate * utilityBase;
  // Admin fee: % of (utilities + area-difference cost when BUYING — a sell credit never
  // reduces the fee base) + a flat amount charged on every calculation. Shown as two rows.
  const adminFeePct = (cfg.adminPct / 100) * (utilities + Math.max(0, areaDiffCost));
  const adminFeeFlat = cfg.adminFlat ?? 0;
  const adminFee = adminFeePct + adminFeeFlat;
  const total = areaDiffCost + utilities;

  const dp = downPayment(originalArea, cfg.downPaymentBands);
  const settlement1 = 0.25 * total + adminFee;

  let estekmal: number;
  let installment: number;
  if (dp >= settlement1) {
    // Rare: the fixed down payment covers all of settlement 1 → no استكمال, split the
    // whole remaining (utilities + admin − down payment) over the 3 annual installments.
    estekmal = 0;
    installment = Math.max(0, (total + adminFee - dp) / 3);
  } else {
    estekmal = settlement1 - dp;
    installment = 0.25 * total;
  }

  const transferFee = cfg.transferRate * standard;
  const inst = round(installment);
  const grandTotal = round(dp + estekmal + transferFee + inst * 3);

  return {
    overMax: false,
    originalArea,
    afterDeduction,
    standard,
    areaDelta,
    mode,
    tradedArea: Math.abs(areaDelta),
    areaDiffCost: round(areaDiffCost),
    utilityRate,
    utilityBase,
    utilities: round(utilities),
    adminFeePct: round(adminFeePct),
    adminFeeFlat: round(adminFeeFlat),
    adminFee: round(adminFee),
    total: round(total),
    downPayment: round(dp),
    estekmal: round(estekmal),
    transferFee: round(transferFee),
    installments: [inst, inst, inst],
    grandTotal,
  };
}
