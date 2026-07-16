import { z } from 'zod';

/** The two brand front-ends that share one backend. */
export const BRANDS = ['portal', 'brokerage'] as const;
export type Brand = (typeof BRANDS)[number];

// ── Editable per-brand appearance (theme) ──────────────────────────────────────────────
// Stored per site in Setting `theme.<brand>` as JSON. buildThemeCss() turns it into a CSS
// override block injected at runtime; it only emits vars that are set, so an unconfigured
// brand renders exactly like the compiled theme.css defaults (fully backward-compatible).
export type BrandTheme = {
  navy?: string; // primary spine (navbars, headings, CTAs) — derives the navy ramp
  gold?: string; // accent / trust-mark — derives the gold ramp
  bg?: string; // light background
  fg?: string; // light text
  darkBg?: string; // dark-mode background
  darkFg?: string; // dark-mode text
  font?: string; // font key (see THEME_FONTS)
  radius?: 'sharp' | 'soft' | 'round';
  density?: 'compact' | 'normal' | 'airy';
};

export const THEME_FONTS = [
  { key: 'tajawal', label: 'Tajawal', varName: '--font-tajawal' },
  { key: 'cairo', label: 'Cairo', varName: '--font-cairo' },
  { key: 'almarai', label: 'Almarai', varName: '--font-almarai' },
] as const;

const RADIUS_SCALE: Record<NonNullable<BrandTheme['radius']>, [number, number, number, number, number]> = {
  sharp: [4, 6, 8, 10, 14],
  soft: [8, 12, 16, 20, 28],
  round: [14, 18, 24, 28, 36],
};
const DENSITY_FONT: Record<NonNullable<BrandTheme['density']>, string> = { compact: '15px', normal: '16px', airy: '17px' };

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('');
}
/** Mix `hex` toward `other` by ratio r (0 = hex, 1 = other). */
function mix(hex: string, other: string, r: number): string {
  const a = parseHex(hex);
  const b = parseHex(other);
  if (!a || !b) return hex;
  return toHex(a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, a[2] + (b[2] - a[2]) * r);
}
// A 50→900 ramp derived from a base that sits around the 800 step (matches the brand navy).
function ramp(base: string): Record<number, string> {
  const W = '#ffffff';
  const K = '#000000';
  return {
    50: mix(base, W, 0.93),
    100: mix(base, W, 0.86),
    200: mix(base, W, 0.7),
    300: mix(base, W, 0.52),
    400: mix(base, W, 0.34),
    500: mix(base, W, 0.2),
    600: mix(base, W, 0.1),
    700: mix(base, K, 0.1),
    800: base,
    900: mix(base, K, 0.28),
  };
}

/** Build the CSS override block for a brand theme. Returns '' when nothing is configured. */
export function buildThemeCss(theme: BrandTheme | null | undefined): string {
  if (!theme) return '';
  const root: string[] = [];
  const dark: string[] = [];

  if (theme.navy && parseHex(theme.navy)) {
    const r = ramp(theme.navy);
    root.push(`--color-navy:${theme.navy}`, `--primary:${theme.navy}`);
    for (const k of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) root.push(`--color-navy-${k}:${r[k]}`);
  }
  if (theme.gold && parseHex(theme.gold)) {
    const r = ramp(theme.gold);
    root.push(`--color-gold:${theme.gold}`, `--accent:${theme.gold}`);
    for (const k of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) root.push(`--color-gold-${k}:${r[k]}`);
  }
  if (theme.bg && parseHex(theme.bg)) root.push(`--bg:${theme.bg}`);
  if (theme.fg && parseHex(theme.fg)) root.push(`--fg:${theme.fg}`);
  if (theme.font) {
    const f = THEME_FONTS.find((x) => x.key === theme.font);
    if (f) root.push(`--font-sans:var(${f.varName}), var(--font-tajawal), 'Segoe UI', system-ui, sans-serif`);
  }
  if (theme.radius && RADIUS_SCALE[theme.radius]) {
    const [sm, md, lg, xl, x2] = RADIUS_SCALE[theme.radius];
    root.push(`--radius-sm:${sm}px`, `--radius-md:${md}px`, `--radius-lg:${lg}px`, `--radius-xl:${xl}px`, `--radius-2xl:${x2}px`);
  }
  if (theme.density && DENSITY_FONT[theme.density]) root.push(`font-size:${DENSITY_FONT[theme.density]}`);
  if (theme.darkBg && parseHex(theme.darkBg)) dark.push(`--bg:${theme.darkBg}`);
  if (theme.darkFg && parseHex(theme.darkFg)) dark.push(`--fg:${theme.darkFg}`);

  let css = '';
  if (root.length) css += `:root{${root.join(';')}}`;
  if (dark.length) css += `.dark{${dark.join(';')}}`;
  return css;
}

/**
 * Shared phone-number validation for both apps. A value is accepted when it is
 * EITHER an Egyptian local mobile (exactly 11 digits starting `01`, e.g.
 * `01001234567`) OR an international number (leading `+` then 8–15 digits, e.g.
 * `+14155550123`). Separators (spaces, dashes, parentheses) are ignored.
 * Pure + client-safe, so both server actions and client forms can share it.
 */
const PHONE_EG_LOCAL = /^01\d{9}$/;
const PHONE_INTL = /^\+\d{8,15}$/;

export function cleanPhone(input: string | null | undefined): string {
  return (input ?? '').trim().replace(/[\s()-]/g, '');
}

export function isValidPhone(input: string | null | undefined): boolean {
  const p = cleanPhone(input);
  return PHONE_EG_LOCAL.test(p) || PHONE_INTL.test(p);
}

/** Digits for a wa.me link: international, no '+', no leading 0 — Egyptian local 01x → 201x.
 *  wa.me/01225227677 is BROKEN (WhatsApp requires a country code); use wa.me/${waPhone(n)}. */
export function waPhone(input: string | null | undefined): string {
  const digits = cleanPhone(input).replace(/\D/g, '');
  return digits.replace(/^0/, '20');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Loose email check — one @, a dot in the domain, no spaces. Good enough for OTP routing. */
export function isValidEmail(input: string | null | undefined): boolean {
  return EMAIL_RE.test((input ?? '').trim());
}

/** RBAC section keys. Add a new key when a new module is introduced.
 *  2026-07 restructure: the old god-sections `marketplace` (split into
 *  listings/catalog/owners/storefront) and parts of `settings` (split out
 *  appearance/analytics) were re-keyed; news/guide/pages merged into `content`.
 *  Migration 20260712160000_rbac_sections copied every role/user grant before
 *  deleting the old Permission rows (zero-lockout). */
export const SECTIONS = [
  'sheets', // rationing (كشوف التقنين)
  'lands', // geo directory + land plots
  'listings', // market offers: moderation, offers inbox, wishlists, price index
  'catalog', // market setup: classifiers, attributes, sections, option lists
  'owners', // owners & partner accounts/applications
  'storefront', // Al Sawarey storefront overview + editors
  'content', // news, guide, building conditions, static pages
  'appearance', // branding, theme, watermark, poster identity
  'analytics', // visitor analytics dashboard + exports
  'staff',
  'customers',
  'settings', // system-only: modules, SMS/APIs, security, tracking config, site, backups
] as const;
export type Section = (typeof SECTIONS)[number];

/** RBAC actions. `MANAGE` implies all the others. */
export const PERM_ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'] as const;
export type PermActionKey = (typeof PERM_ACTIONS)[number];

// ── Marketplace: listing detail rules ───────────────────────────────────────────────

/**
 * Attribute keys that are MANDATORY on every listing (basic details). Enforced client-side in
 * both listing forms (staff/customer full form + partner lean form) and used to render a
 * required marker. When such an attribute has exactly one active option it is auto-selected, so
 * a single-choice field (e.g. one city) never blocks the seller. Currently: the city
 * (`city`) — every listing must record its city (only New Obour City today).
 */
export const REQUIRED_LISTING_ATTR_KEYS = ['city'] as const;

// ── Module 2: land / neighborhood option lists (bilingual where shown to users) ──

/** Common plot-area presets (m²) in New Obour. Default "standard areas" for rounding. */
export const AREA_PRESETS = [209, 276, 350, 400, 450, 500, 624, 682, 777] as const;

/** Round an allocated area to the nearest standard area; values over 900 m² pass through. */
export function roundToStandardArea(value: number, standardAreas: readonly number[] = AREA_PRESETS): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value > 900) return value;
  const list = standardAreas.length ? standardAreas : AREA_PRESETS;
  return list.reduce((best, a) => (Math.abs(a - value) < Math.abs(best - value) ? a : best), list[0]!);
}

/** Whole-EGP money, e.g. 1250000 → "1,250,000 جنيه" / "1,250,000 EGP". */
export function formatMoneyEgp(n: number, locale: 'ar' | 'en' = 'ar'): string {
  const v = Math.round(n).toLocaleString('en-US');
  return locale === 'en' ? `${v} EGP` : `${v} جنيه`;
}

/** Money rounded to nearest 1000, shown in thousands, e.g. 68741 → "69 ألف جنيه" / "69K EGP". */
export function formatMoneyThousands(n: number, locale: 'ar' | 'en' = 'ar'): string {
  const v = Math.round(n / 1000).toLocaleString('en-US');
  return locale === 'en' ? `${v}K EGP` : `${v} ألف جنيه`;
}

/** Area in m², e.g. 209 → "209 م²" / "209 m²". */
export function formatArea(n: number, locale: 'ar' | 'en' = 'ar'): string {
  const v = (Math.round(n * 100) / 100).toLocaleString('en-US');
  return locale === 'en' ? `${v} m²` : `${v} م²`;
}

export type DetailConfig = {
  yesLabelAr?: string;
  yesLabelEn?: string;
  noLabelAr?: string;
  noLabelEn?: string;
  multiple?: boolean;
};

// Unit labels are stored in Arabic; only the SUFFIX is localized for EN display.
// Keep in sync with @noc/i18n's UNIT_EN (neither package may depend on the other).
const UNIT_EN_LABEL: Record<string, string> = {
  'م²': 'm²',
  'م': 'm',
  'غرفة': 'room',
  'حمام': 'bath',
  'قطعة': 'pc',
  'واجهة': 'frontage',
  'سنة': 'yr',
  '%': '%',
  'ج.م': 'EGP',
};

/** Format a stored listing-detail value for public display, by its value type.
 *  SELECT/MULTI_SELECT are resolved by the caller (option labels); this covers the rest. */
export function formatDetailValue(opts: {
  type: string;
  unit?: string | null;
  number?: number | null;
  bool?: boolean | null;
  text?: string | null;
  config?: DetailConfig | null;
  locale?: 'ar' | 'en';
  standardAreas?: readonly number[];
}): string | null {
  const { type, unit, number, bool, text, config, standardAreas } = opts;
  const locale = opts.locale ?? 'ar';
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);
  switch (type) {
    // A money attribute of exactly 0 means the fee is settled → show "مدفوع"/"Paid"
    // (no amount, no currency) everywhere: both sites, cards, and the poster.
    case 'MONEY':
      return number != null ? (number === 0 ? L('مدفوع', 'Paid') : formatMoneyEgp(number, locale)) : null;
    case 'MONEY_THOUSANDS':
      return number != null ? (number === 0 ? L('مدفوع', 'Paid') : formatMoneyThousands(number, locale)) : null;
    case 'AREA_ORIGINAL':
      return number != null ? formatArea(number, locale) : null;
    case 'AREA_ALLOCATED':
      return number != null ? formatArea(roundToStandardArea(number, standardAreas ?? AREA_PRESETS), locale) : null;
    case 'NUMBER': {
      if (number == null) return null;
      const u = unit ? (locale === 'en' ? (UNIT_EN_LABEL[unit] ?? unit) : unit) : '';
      return `${number.toLocaleString('en-US')}${u ? ` ${u}` : ''}`;
    }
    case 'YESNO':
      if (bool == null) return null;
      return bool ? L(config?.yesLabelAr || 'نعم', config?.yesLabelEn || 'Yes') : L(config?.noLabelAr || 'لا', config?.noLabelEn || 'No');
    case 'BOOLEAN':
      return bool == null ? null : bool ? L('نعم', 'Yes') : L('لا', 'No');
    default:
      // TEXT / TEXTAREA / URL / PHONE / DATE / DATE_FULL
      return text && text.trim() ? text : null;
  }
}

/** What a neighborhood permits building. */
export const BUILDING_TYPES = [
  { key: 'home', ar: 'منزل', en: 'Home' },
  { key: 'building', ar: 'عمارة', en: 'Building' },
  { key: 'villa', ar: 'فيلا', en: 'Villa' },
] as const;

/** Main roads/axes a neighborhood can sit on. */
export const MAIN_ROADS = [
  { key: 'R2', ar: 'R2', en: 'R2' },
  { key: 'R3', ar: 'R3', en: 'R3' },
  { key: 'R4', ar: 'R4', en: 'R4' },
  { key: 'R5', ar: 'R5', en: 'R5' },
  { key: 'R6', ar: 'R6', en: 'R6' },
  { key: 'ring', ar: 'الطريق الدائري الإقليمي', en: 'Regional Ring Road' },
  { key: 'middle_ring', ar: 'الطريق الأوسطي', en: 'Middle Ring Road' },
  { key: 'ismailia', ar: 'طريق الإسماعيلية', en: 'Ismailia Road' },
  { key: 'belbees', ar: 'طريق بلبيس', en: 'Belbees Road' },
] as const;

/** Coarse locations for rationing-sheet ("تقنين") lands. */
export const SHEET_LOCATIONS = [
  { key: 'qadessia', ar: 'القادسية', en: 'Qadessia' },
  { key: 'amal', ar: 'الأمل', en: 'Amal' },
  { key: 'talaee', ar: 'الطلائع', en: 'Eltalaee' },
] as const;

/**
 * Environment schema. Validate where needed with `envSchema.parse(process.env)`.
 * Not parsed at import time so tooling (lint/build) never crashes on missing vars.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  SMS_PROVIDER: z.enum(['console', 'smsmisr', 'victorylink', 'twilio']).default('console'),
  UPLOAD_DIR: z.string().default('./uploads'),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(6).optional(),
  PORTAL_URL: z.string().url().optional(),
  BROKERAGE_URL: z.string().url().optional(),
});
export type Env = z.infer<typeof envSchema>;

// ── Social profile links (the Organization / RealEstateAgent `sameAs` entity signal) ──
// Stored per brand as a newline/comma-separated list of profile URLs in Setting; parsed
// here so both apps + the admin editor share one definition. Pure (no deps).

export const SOCIAL_SETTING_KEYS = { newobour: 'social.newobour', alsawarey: 'social.alsawarey' } as const;
export type SocialBrand = keyof typeof SOCIAL_SETTING_KEYS;

/** Parse a newline/comma-separated list into de-duped absolute http(s) URLs. */
export function parseSocialLinks(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const url = part.trim();
    if (/^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

// ── Al Sawarey "sell your land" page content (editable in the New Obour backend) ──

export type SellContent = {
  announceTitle: string;
  announceBody: string;
  policyPageSlug: string; // optional Pages slug for the full sell/pricing policy (empty = show inline)
  services: string[];
  policy: string[];
  pricing: { level: string; saleTime: string }[];
  requiredSheet: { proof: string[]; land: string[]; price: string[] };
  requiredAllocated: { proof: string[]; land: string[]; price: string[] };
};

export const DEFAULT_SELL_CONTENT: SellContent = {
  announceTitle: 'اعرض أرضك للبيع من خلال الصواري',
  policyPageSlug: '',
  announceBody: 'سجّل بيانات أرضك وفريقنا يتولّى تقييمها وتسويقها وبيعها عبر شبكتنا — بأسرع وقت وأفضل سعر.',
  services: [
    'التقدير العادل لسعر الأرض',
    'عرض الأرض في موقعنا ومنصّاتنا المختلفة',
    'تشغيل إعلانات مموّلة على الأراضي المعروضة للبيع',
    'الوصول للمشتري في أسرع وقت',
    'تسهيل إجراءات نقل الملكية في جهاز المدينة',
    'تسهيل وضمان نقل الأموال من المشتري للبائع',
    'تقديم خدمات ما بعد البيع للمشتري',
  ],
  policy: [
    'يتم الاتفاق على سعر البيع مع البائع.',
    'سعر البيع هو السعر الذي يدفعه المشتري شاملاً عمولة البيع.',
    'يحق للصواري التفاوض مع المشتري بحد أقصى ١.٥٪ من ثمن الأرض (بموافقة المالك).',
    'يحق للصواري زيادة سعر الأرض حسب ظروف السوق ودون الرجوع للعميل؛ ويحصل البائع على السعر الفعلي الذي عُرضت به الأرض مخصومًا منه عمولة البيع.',
    'عمولة البيع ١.٥٪ من ثمن الأرض، بحد أدنى ١٥٬٠٠٠ جنيه وحد أقصى ٤٠٬٠٠٠ جنيه.',
    'يتم خصم العمولة من ثمن الأرض المدفوع.',
  ],
  pricing: [
    { level: 'بسعر أقل من السعر التقديري', saleTime: '٧ – ١٤ يوم' },
    { level: 'بالسعر التقديري', saleTime: '١٤ – ٣٠ يوم' },
    { level: 'أعلى من التقديري حتى ١٥٪', saleTime: '٣٠ – ٦٠ يوم' },
    { level: 'أعلى من التقديري حتى ١٥٪ (عرض محدود)', saleTime: '٦٠ – ١٥٠ يوم' },
    { level: 'أعلى من التقديري بأكثر من ١٥٪', saleTime: 'لا يمكن عرضها للبيع من خلالنا' },
  ],
  requiredSheet: {
    proof: ['صورة العقد', 'صورة كشف التقنين', 'صورة إثبات الشخصية'],
    land: ['المساحة', 'الموقع الأصلي'],
    price: ['نساعدك في تقييم القطعة', 'يتم الاتفاق على السعر النهائي مع البائع'],
  },
  requiredAllocated: {
    proof: ['جواب التخصيص', 'صورة إثبات الشخصية'],
    land: ['المساحة', 'الموقع (الحي – المجاورة – البلوك – القطعة)', 'الخريطة'],
    price: ['نساعدك في تقييم القطعة', 'يتم الاتفاق على السعر النهائي مع البائع'],
  },
};

// ---------------------------------------------------------------------------
// Al Sawarey storefront content — homepage + global chrome, editable from the New
// Obour backend. Shared shape so the portal editor and the brokerage app agree.
// Content-only (bilingual text, links, images, toggles, order); no theming.
// ---------------------------------------------------------------------------

export type Loc = { ar: string; en: string };
export type StoreLink = { label: Loc; href: string };
export type StoreMenuGroup = { title: Loc; links: StoreLink[] };
export type StoreSectionKey = 'quickFilters' | 'featured' | 'latest' | 'sellBand' | 'sold';
export type StoreSection = { key: StoreSectionKey; enabled: boolean };

export type StorefrontContent = {
  hero: {
    title: Loc;
    subtitle: Loc;
    searchPlaceholder: Loc;
    showSearch: boolean;
    primaryCta: StoreLink;
    secondaryCta: StoreLink;
    stats: { show: boolean; availableLabel: Loc; soldLabel: Loc; extraValue: Loc; extraLabel: Loc };
  };
  sections: StoreSection[]; // render order + visibility (hero is always first, not listed)
  titles: { featured: Loc; latest: Loc; sold: Loc };
  sellBand: { title: Loc; body: Loc; cta: StoreLink };
  featurePills: StoreLink[];
  areaChips: StoreLink[];
  priceChips: StoreLink[]; // price-tier quick filters (Cheapest / under 1M / …)
  nav: { allLands: StoreLink; featured: StoreLink; sell: StoreLink; groups: StoreMenuGroup[] };
  contact: { whatsapp: string; socials: { platform: string; url: string }[] };
  footer: { name: Loc; slogan: Loc };
};

const loc = (ar: string, en: string): Loc => ({ ar, en });

export const DEFAULT_STOREFRONT: StorefrontContent = {
  hero: {
    title: loc('استثمارك العقاري يبدأ من هنا', 'Your land investment starts here'),
    subtitle: loc(
      'أراضٍ مختارة للبيع في العبور الجديدة وما حولها — تصفّح، قارن، وتواصل معنا للشراء',
      'Selected lands for sale in New Obour and beyond — browse, compare, and contact us to buy',
    ),
    searchPlaceholder: loc('ابحث بالمساحة، المنطقة، أو رقم الإعلان…', 'Search by area, district, or ad number…'),
    showSearch: true,
    primaryCta: { label: loc('تصفّح الأراضي', 'Browse lands'), href: '/listings' },
    secondaryCta: { label: loc('اعرض أرضك للبيع', 'Sell your land'), href: '/sell' },
    stats: {
      show: true,
      availableLabel: loc('أرض متاحة', 'lands available'),
      soldLabel: loc('تم بيعها', 'sold'),
      extraValue: loc('مجانًا', 'Free'),
      extraLabel: loc('وساطة للمشتري', 'brokerage for buyers'),
    },
  },
  sections: [
    { key: 'quickFilters', enabled: true },
    { key: 'featured', enabled: true },
    { key: 'latest', enabled: true },
    { key: 'sellBand', enabled: true },
    { key: 'sold', enabled: true },
  ],
  titles: {
    featured: loc('عروض مميزة', 'Featured lands'),
    latest: loc('أحدث الأراضي', 'Latest lands'),
    sold: loc('تم بيعها مؤخراً', 'Recently sold'),
  },
  sellBand: {
    title: loc('عندك أرض للبيع؟', 'Have land to sell?'),
    body: loc('اعرضها معنا — كشف أو تخصيص — ونتواصل معك', 'List it with us — reconciliation or allocated — and we’ll reach out'),
    cta: { label: loc('اعرض أرضك', 'List your land'), href: '/sell' },
  },
  featurePills: [
    { label: loc('ناصية', 'Corner'), href: '/listings?corner=1' },
    { label: loc('شارع رئيسي', 'Main road'), href: '/listings?main=1' },
    { label: loc('متوصلة بالمرافق', 'With services'), href: '/listings?services=1' },
    { label: loc('على حديقة', 'Garden view'), href: '/listings?view=garden' },
    { label: loc('الأرخص سعراً', 'Best price'), href: '/listings?sort=price_asc' },
  ],
  areaChips: [
    { label: loc('209 م²', '209 m²'), href: '/listings?area=209' },
    { label: loc('276 م²', '276 m²'), href: '/listings?area=276' },
    { label: loc('350 م²', '350 m²'), href: '/listings?area=350' },
    { label: loc('400 م²', '400 m²'), href: '/listings?area=400' },
    { label: loc('450 م²', '450 m²'), href: '/listings?area=450' },
    { label: loc('500 م²', '500 m²'), href: '/listings?area=500' },
    { label: loc('600–750 م²', '600–750 m²'), href: '/listings?areaMin=600&areaMax=750' },
    { label: loc('751–1000 م²', '751–1000 m²'), href: '/listings?areaMin=751&areaMax=1000' },
    { label: loc('+1000 م²', '1000+ m²'), href: '/listings?areaMin=1000' },
  ],
  priceChips: [
    { label: loc('الأرخص', 'Cheapest'), href: '/listings?sort=price_asc' },
    { label: loc('أقل من ٥٠٠ ألف', 'Under 500k'), href: '/listings?priceMax=500000' },
    { label: loc('أقل من مليون', 'Under 1M'), href: '/listings?priceMax=1000000' },
    { label: loc('١ – ٢ مليون', '1–2M'), href: '/listings?priceMin=1000000&priceMax=2000000' },
    { label: loc('أكثر من مليون', 'Over 1M'), href: '/listings?priceMin=1000000' },
  ],
  nav: {
    allLands: { label: loc('كل الأراضي', 'All lands'), href: '/listings' },
    featured: { label: loc('مميز', 'Featured'), href: '/listings?featured=1' },
    sell: { label: loc('بيع أرضك', 'Sell your land'), href: '/sell' },
    groups: [
      {
        title: loc('المساحات', 'Areas'),
        links: [
          { label: loc('209 م²', '209 m²'), href: '/listings?area=209' },
          { label: loc('276 م²', '276 m²'), href: '/listings?area=276' },
          { label: loc('350 م²', '350 m²'), href: '/listings?area=350' },
          { label: loc('400 م²', '400 m²'), href: '/listings?area=400' },
          { label: loc('450 م²', '450 m²'), href: '/listings?area=450' },
          { label: loc('500 م²', '500 m²'), href: '/listings?area=500' },
          { label: loc('600 – 750 م²', '600–750 m²'), href: '/listings?areaMin=600&areaMax=750' },
          { label: loc('751 – 1000 م²', '751–1000 m²'), href: '/listings?areaMin=751&areaMax=1000' },
          { label: loc('أكثر من 1000 م²', 'Over 1000 m²'), href: '/listings?areaMin=1000' },
        ],
      },
      {
        title: loc('المميزات', 'Features'),
        links: [
          { label: loc('أراضي ناصية', 'Corner'), href: '/listings?corner=1' },
          { label: loc('على شارع رئيسي', 'Main road'), href: '/listings?main=1' },
          { label: loc('متوصلة بالمرافق', 'With services'), href: '/listings?services=1' },
          { label: loc('الأرخص سعراً', 'Best price'), href: '/listings?sort=price_asc' },
        ],
      },
    ],
  },
  contact: {
    whatsapp: '+201040810000',
    socials: [
      { platform: 'facebook', url: '' },
      { platform: 'whatsapp', url: 'https://wa.me/201040810000' },
    ],
  },
  footer: {
    name: loc('الصواري', 'Al Sawarey'),
    slogan: loc('للاستثمار العقاري', 'Real Estate Investment'),
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Merge `override` onto `base`, keeping base's shape: recurse into plain objects,
// replace arrays/primitives outright. Keys absent from base are ignored.
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (!(key in override)) continue;
    const b = (base as Record<string, unknown>)[key];
    out[key] = isPlainObject(b) ? deepMerge(b, override[key]) : override[key];
  }
  return out as T;
}

/** Merge an admin override blob over the storefront defaults (shape-preserving). */
export function mergeStorefront(override: unknown): StorefrontContent {
  // Back-compat: blobs saved before 2026-07 stored footer.brandLine — treat it as the slogan.
  if (isPlainObject(override) && isPlainObject(override.footer)) {
    const f = override.footer as Record<string, unknown>;
    if (f.brandLine != null && f.slogan == null) f.slogan = f.brandLine;
  }
  return deepMerge(DEFAULT_STOREFRONT, override);
}
