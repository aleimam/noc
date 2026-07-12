import { prisma } from '@noc/db';

// Canonical geo-explorer URLs (SEO restructure, owner-approved 2026-07):
//   city          /explore/city/<City.key>
//   district      /explore/district/<District.key>
//   neighborhood  /explore/neighborhood/<arabic-slug>--<id>
// Every browse surface emits these; the detail pages 308-canonicalize legacy cuid params.
// Server-only lib (resolvers use Prisma) — client components receive prebuilt hrefs as props.

/** Slug that keeps Arabic letters, Latin letters and digits; spaces and '/' become '-';
 *  everything else is stripped; runs of '-' collapse. */
export function arabicSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9؀-ۿ-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 80);
}

export function cityHref(c: { id: string; key: string | null }): string {
  return `/explore/city/${encodeURIComponent(c.key || c.id)}`;
}

export function districtHref(d: { id: string; key: string | null }): string {
  return `/explore/district/${encodeURIComponent(d.key || d.id)}`;
}

type NeighborhoodLike = { id: string; nameAr: string; district?: { nameAr: string } | null };

/** Raw (undecoded) canonical param for a neighborhood: `<slug>--<id>` (just `<id>` when the
 *  slug comes out empty). Include the district for the full canonical slug. */
export function neighborhoodParam(n: NeighborhoodLike): string {
  const slug = arabicSlug(n.district ? `${n.district.nameAr}-${n.nameAr}` : n.nameAr);
  return slug ? `${slug}--${n.id}` : n.id;
}

export function neighborhoodHref(n: NeighborhoodLike): string {
  return `/explore/neighborhood/${encodeURIComponent(neighborhoodParam(n))}`;
}

const safeDecode = (s: string): string | null => {
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return null; // malformed percent-encoding → treat as unknown (404), never 500
  }
};

/** Resolve a /explore/city/<param> segment — the param is either the City.key or a legacy cuid. */
export async function resolveCityId(param: string): Promise<{ id: string; canonicalParam: string } | null> {
  const dec = safeDecode(param);
  if (!dec) return null;
  const c = await prisma.city.findFirst({ where: { OR: [{ key: dec }, { id: dec }] }, select: { id: true, key: true } });
  return c ? { id: c.id, canonicalParam: c.key || c.id } : null;
}

/** Resolve a /explore/district/<param> segment — the param is either the District.key or a legacy cuid. */
export async function resolveDistrictId(param: string): Promise<{ id: string; canonicalParam: string } | null> {
  const dec = safeDecode(param);
  if (!dec) return null;
  const d = await prisma.district.findFirst({ where: { OR: [{ key: dec }, { id: dec }] }, select: { id: true, key: true } });
  return d ? { id: d.id, canonicalParam: d.key || d.id } : null;
}

/** Resolve a /explore/neighborhood/<param> segment — the id is the text after the LAST '--';
 *  a param with no '--' is a bare id (legacy cuid). */
export async function resolveNeighborhoodId(param: string): Promise<{ id: string } | null> {
  const dec = safeDecode(param);
  if (!dec) return null;
  const at = dec.lastIndexOf('--');
  const id = at >= 0 ? dec.slice(at + 2) : dec;
  if (!id) return null;
  const n = await prisma.neighborhood.findUnique({ where: { id }, select: { id: true } });
  return n ? { id: n.id } : null;
}
