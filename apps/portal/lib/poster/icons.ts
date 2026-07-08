// Poster group icons — plain SVG fragments drawn in a -16..16 box (gold shape +
// navy detail, matching the approved identity). Kept free of any server-only
// imports so the admin icon picker can render live previews in the browser.
const GOLD = '#e7ab16', NAVY = '#0f1f4b';

export const POSTER_ICONS = {
  pin: `<path d="M0,-16 C-9,-16 -16,-9 -16,0 C-16,10 0,22 0,22 C0,22 16,10 16,0 C16,-9 9,-16 0,-16 Z" fill="${GOLD}"/><circle cx="0" cy="-1" r="5.5" fill="${NAVY}"/>`,
  bld: `<rect x="-15" y="-6" width="12" height="20" fill="${GOLD}"/><rect x="1" y="-15" width="14" height="29" fill="${GOLD}"/><rect x="4" y="-11" width="3" height="3" fill="${NAVY}"/><rect x="9" y="-11" width="3" height="3" fill="${NAVY}"/>`,
  doc: `<rect x="-13" y="-16" width="26" height="32" rx="3" fill="${GOLD}"/><line x1="-7" y1="-8" x2="7" y2="-8" stroke="${NAVY}" stroke-width="2.5"/><line x1="-7" y1="0" x2="7" y2="0" stroke="${NAVY}" stroke-width="2.5"/><line x1="-7" y1="8" x2="3" y2="8" stroke="${NAVY}" stroke-width="2.5"/>`,
  coin: `<circle cx="0" cy="0" r="15" fill="${GOLD}"/><circle cx="0" cy="0" r="9" fill="none" stroke="${NAVY}" stroke-width="2.5"/><line x1="0" y1="-5" x2="0" y2="5" stroke="${NAVY}" stroke-width="2.5"/>`,
  bolt: `<path d="M3,-16 L-10,3 L-2,3 L-4,16 L10,-4 L2,-4 Z" fill="${GOLD}"/>`,
  star: `<path d="M0,-15 L4.4,-4.6 L15,-4.6 L6.6,2.9 L9.3,14 L0,7.5 L-9.3,14 L-6.6,2.9 L-15,-4.6 L-4.4,-4.6 Z" fill="${GOLD}"/>`,
  ruler: `<g transform="rotate(-45)"><rect x="-16" y="-6" width="32" height="12" rx="2" fill="${GOLD}"/><line x1="-9" y1="-6" x2="-9" y2="0" stroke="${NAVY}" stroke-width="2"/><line x1="-2" y1="-6" x2="-2" y2="0" stroke="${NAVY}" stroke-width="2"/><line x1="5" y1="-6" x2="5" y2="0" stroke="${NAVY}" stroke-width="2"/><line x1="11" y1="-6" x2="11" y2="0" stroke="${NAVY}" stroke-width="2"/></g>`,
  key: `<circle cx="-7" cy="-7" r="6.5" fill="none" stroke="${GOLD}" stroke-width="5"/><line x1="-2" y1="-2" x2="13" y2="13" stroke="${GOLD}" stroke-width="5"/><line x1="7" y1="13" x2="13" y2="7" stroke="${GOLD}" stroke-width="5"/>`,
} as const;

export type PosterIconKey = keyof typeof POSTER_ICONS;
export const POSTER_ICON_KEYS = Object.keys(POSTER_ICONS) as PosterIconKey[];

/** Fonts installed on the production host for the generated images (admin-selectable). */
export const POSTER_FONTS = ['Almarai', 'Tajawal', 'Cairo', 'Changa'] as const;

export function isPosterIcon(v: string | null | undefined): v is PosterIconKey {
  return !!v && v in POSTER_ICONS;
}

/** Bilingual display names for the admin picker. */
export const POSTER_ICON_LABELS: Record<PosterIconKey, { ar: string; en: string }> = {
  pin: { ar: 'موقع', en: 'Location' },
  bld: { ar: 'مبانٍ', en: 'Buildings' },
  doc: { ar: 'مستندات', en: 'Documents' },
  coin: { ar: 'مالية', en: 'Finance' },
  bolt: { ar: 'مرافق', en: 'Utilities' },
  star: { ar: 'مميزات', en: 'Features' },
  ruler: { ar: 'قياسات', en: 'Dimensions' },
  key: { ar: 'تسليم', en: 'Handover' },
};
