import { prisma } from '@noc/db';

/** ASCII slug from English text (keywords for SEO-friendly URLs). */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 60);
}

/** SEO-friendly market path: /market/<english-slug>-<adNumber>. The ad number (trailing
 *  digits) is the stable lookup key; falls back to the cuid when there is no ad number. */
export function marketHref(l: { id: string; adNumber: string | null; typeEn: string | null; area: number | null }): string {
  if (!l.adNumber) return `/market/${l.id}`;
  const slug = slugify([l.typeEn || 'listing', l.area ? `${l.area}m` : ''].filter(Boolean).join(' ')) || 'listing';
  return `/market/${slug}-${l.adNumber}`;
}

/** Resolve a /market/<param> segment to a listing id — the param is either the SEO slug
 *  ending in the ad number (…-2607002) or a legacy cuid. */
export async function resolveMarketListingId(param: string): Promise<string | null> {
  const dec = decodeURIComponent(param).trim();
  const tail = dec.split('-').pop() ?? '';
  const where = /^\d+$/.test(tail) ? { adNumber: tail } : { id: dec };
  const found = await prisma.listing.findFirst({ where, select: { id: true } });
  return found?.id ?? null;
}
