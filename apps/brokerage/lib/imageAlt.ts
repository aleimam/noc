// Image-SEO alt-text builders (SEO Phase 2). Pure functions — NO prisma / no server
// imports — so both server components and client components can call them. Digits are
// kept Western (toLocaleString('en-US')) per the project convention (dev + prod both
// render Western numerals; only units/labels localize).
//
// Mirrored verbatim in apps/brokerage/lib/imageAlt.ts (the advantages.ts mirror pattern):
// keep the two files in sync.

const clean = (s?: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

export type ListingAltParts = {
  /** Localized listing type, e.g. "أرض" / "Land". */
  type?: string | null;
  /** Actual area in m². */
  area?: number | null;
  /** Localized purpose, e.g. "للبيع" / "for sale" (optional). */
  purpose?: string | null;
  /** Localized district name. */
  district?: string | null;
  /** Localized neighborhood name. */
  neighborhood?: string | null;
};

/**
 * Descriptive alt text for a listing's photos. Every part is optional and missing parts
 * are dropped with no dangling separators. Examples:
 *   AR: "أرض 500 م² للبيع — الحي العاشر، مجاورة 5"
 *   EN: "500 m² land for sale — District 10, Neighborhood 5"
 */
export function listingAlt(l: ListingAltParts, locale: 'ar' | 'en'): string {
  const type = clean(l.type);
  const purpose = clean(l.purpose);
  const district = clean(l.district);
  const neighborhood = clean(l.neighborhood);
  const areaStr =
    l.area != null && Number.isFinite(l.area)
      ? `${Number(l.area).toLocaleString('en-US')} ${locale === 'ar' ? 'م²' : 'm²'}`
      : '';

  // The lead reads naturally per language: AR "أرض 500 م² للبيع", EN "500 m² land for sale".
  const lead = (locale === 'ar' ? [type, areaStr, purpose] : [areaStr, type, purpose]).filter(Boolean).join(' ');
  const where = [district, neighborhood].filter(Boolean).join(locale === 'ar' ? '، ' : ', ');

  return [lead, where].filter(Boolean).join(' — ');
}

/**
 * Alt text for an area / custom geo photo (map, neighborhood photo, update photo …):
 *   "<title> — <area name>"
 * Either part may be missing; when the photo has no title a generic localized word is used
 * so the alt is never empty when we at least know the area.
 */
export function geoPhotoAlt(areaName?: string | null, title?: string | null, locale: 'ar' | 'en' = 'ar'): string {
  const t = clean(title) || (locale === 'ar' ? 'صورة' : 'Photo');
  const a = clean(areaName);
  return [t, a].filter(Boolean).join(' — ');
}
