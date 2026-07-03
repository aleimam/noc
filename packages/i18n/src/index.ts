export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Arabic is the default language. */
export const DEFAULT_LOCALE: Locale = 'ar';

/** Cookie the language switcher writes the chosen locale to. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/** Text direction for a locale. Arabic is RTL. */
export function dirForLocale(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Bilingual content fallback: show the value in the active language, or the other language if
 * the active one is empty. Use for admin-entered content (titles, bodies, names) so a missing
 * translation renders the available language instead of blank. Not for UI chrome — those
 * strings come from the message bundles.
 */
export function pick(ar: string | null | undefined, en: string | null | undefined, locale: Locale): string {
  const a = (ar ?? '').trim();
  const e = (en ?? '').trim();
  return locale === 'en' ? e || a : a || e;
}

// Unit labels are stored/entered in Arabic. Only the unit SUFFIX is localized —
// the entered value itself (a number, a typed note) never changes between locales.
const UNIT_EN: Record<string, string> = {
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

/** Localize a unit label; unknown units fall back to the stored (Arabic) form. */
export function localizeUnit(unit: string | null | undefined, locale: Locale): string {
  if (!unit) return '';
  return locale === 'en' ? (UNIT_EN[unit] ?? unit) : unit;
}

/** Currency label (Egyptian pound). */
export function currency(locale: Locale): string {
  return locale === 'en' ? 'EGP' : 'ج.م';
}
