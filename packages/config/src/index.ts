import { z } from 'zod';

/** The two brand front-ends that share one backend. */
export const BRANDS = ['portal', 'brokerage'] as const;
export type Brand = (typeof BRANDS)[number];

/** RBAC section keys. Add a new key when a new module is introduced. */
export const SECTIONS = [
  'homepage',
  'staff',
  'customers',
  'partners',
  'media',
  'settings',
  // business modules (wired in later milestones)
  'sheets',
  'lands',
  'districts',
  'owners',
  'commissions',
  'marketplace',
  'news',
  'guide',
] as const;
export type Section = (typeof SECTIONS)[number];

/** RBAC actions. `MANAGE` implies all the others. */
export const PERM_ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'] as const;
export type PermActionKey = (typeof PERM_ACTIONS)[number];

// ── Module 2: land / neighborhood option lists (bilingual where shown to users) ──

/** Common plot-area presets (m²) in New Obour. */
export const AREA_PRESETS = [209, 276, 350, 400, 450, 500, 624, 682, 777] as const;

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

// ── ALSWARY "sell your land" page content (editable in the New Obour backend) ──

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
// ALSWARY storefront content — homepage + global chrome, editable from the New
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
  footer: { brandLine: Loc };
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
  footer: { brandLine: loc('الصواري للاستثمار العقاري', 'ALSWARY Real-estate Investment') },
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
  return deepMerge(DEFAULT_STOREFRONT, override);
}
