// Storefront config: central contact, top-menu groups, and the featured-filter banners.
// Banner images live in /public/market/banners (copied from the Al Sawarey asset folder).
// Each entry links to the catalogue with the matching filter querystring.

export const WHATSAPP = '+201040810000';

export function waLink(text: string, number: string = WHATSAPP): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;
}

export type MenuLink = { labelAr: string; labelEn: string; href: string };

// Common land area presets (m²) → /listings?area=
export const AREA_PRESETS = [209, 276, 350, 400, 450, 500] as const;

export const MENU: { titleAr: string; titleEn: string; links: MenuLink[] }[] = [
  {
    titleAr: 'المساحات',
    titleEn: 'Areas',
    links: [
      ...AREA_PRESETS.map((a) => ({ labelAr: `${a} م²`, labelEn: `${a} m²`, href: `/listings?area=${a}` })),
      { labelAr: '600 - 750 م²', labelEn: '600–750 m²', href: '/listings?areaMin=600&areaMax=750' },
      { labelAr: '751 - 1000 م²', labelEn: '751–1000 m²', href: '/listings?areaMin=751&areaMax=1000' },
      { labelAr: 'أكثر من 1000 م²', labelEn: 'Over 1000 m²', href: '/listings?areaMin=1000' },
    ],
  },
  {
    titleAr: 'المميزات',
    titleEn: 'Features',
    links: [
      { labelAr: 'أراضي ناصية', labelEn: 'Corner', href: '/listings?corner=1' },
      { labelAr: 'على شارع رئيسي', labelEn: 'Main road', href: '/listings?main=1' },
      { labelAr: 'متوصلة بالمرافق', labelEn: 'With services', href: '/listings?services=1' },
      { labelAr: 'الأرخص سعراً', labelEn: 'Best price', href: '/listings?sort=price_asc' },
    ],
  },
];

// Featured banners shown as a clickable strip on the home page (filename → filter).
export const BANNERS: { img: string; href: string; alt: string }[] = [
  { img: '01_all_available_lands.png', href: '/listings', alt: 'كل الأراضي المتاحة' },
  { img: '02_corner_lands.png', href: '/listings?corner=1', alt: 'أراضي الناصية' },
  { img: '03_main_road_lands.png', href: '/listings?main=1', alt: 'أراضي الشارع الرئيسي' },
  { img: '04_services_lands.png', href: '/listings?services=1', alt: 'أراضي بالمرافق' },
  { img: '05_garden_lands.png', href: '/listings?view=garden', alt: 'أراضي الحديقة' },
  { img: '06_cheap_lands.png', href: '/listings?sort=price_asc', alt: 'أراضي اقتصادية' },
  { img: '07_lands_209m.png', href: '/listings?area=209', alt: '209 م²' },
  { img: '08_lands_276m.png', href: '/listings?area=276', alt: '276 م²' },
  { img: '09_lands_350m.png', href: '/listings?area=350', alt: '350 م²' },
  { img: '10_lands_400m.png', href: '/listings?area=400', alt: '400 م²' },
  { img: '11_lands_450m.png', href: '/listings?area=450', alt: '450 م²' },
  { img: '12_lands_500m.png', href: '/listings?area=500', alt: '500 م²' },
  { img: '13_lands_600_to_750m.png', href: '/listings?areaMin=600&areaMax=750', alt: '600–750 م²' },
  { img: '14_lands_751_to_1000m.png', href: '/listings?areaMin=751&areaMax=1000', alt: '751–1000 م²' },
  { img: '15_lands_over_1000m.png', href: '/listings?areaMin=1000', alt: 'أكثر من 1000 م²' },
];
