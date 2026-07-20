import { prisma } from '@noc/db';

/**
 * Resolve the two "grab-and-go" generated assets — the big poster and the annotated location
 * map — for a set of listings, so a listing LIST can link straight to them without opening the
 * editor. Both are stored as directly-servable `/uploads/...` URLs (the poster on an
 * `Attachment`, the map on `AreaMap`), so callers render plain `<a target="_blank">` links.
 *
 * `branded`:
 *  - false (partners) → the UNBRANDED poster + the CLEAN map. Partners see unbranded assets only
 *    (the owner-display rule in CLAUDE.md) — these are theirs to reuse.
 *  - true (admin/staff) → the New Obour-branded poster (always generated) + the branded map,
 *    each falling back to the unbranded/clean version if the branded one is missing.
 */
export type ListingAssets = { mapUrl: string | null; posterUrl: string | null };

export async function resolveListingAssets(
  listingIds: string[],
  opts: { branded: boolean },
): Promise<Map<string, ListingAssets>> {
  const out = new Map<string, ListingAssets>();
  const ids = [...new Set(listingIds)].filter(Boolean);
  if (!ids.length) return out;

  const [posters, maps] = await Promise.all([
    prisma.attachment.findMany({
      where: { ownerType: 'ListingPoster', ownerId: { in: ids }, stampCategory: { startsWith: 'poster:' } },
      select: { ownerId: true, stampCategory: true, path: true },
    }),
    prisma.areaMap.findMany({
      where: { level: 'listing', areaId: { in: ids }, kind: 'location' },
      select: { areaId: true, cleanPath: true, newobourPath: true },
    }),
  ]);

  // Poster: pick the wanted brand per listing, falling back to unbranded.
  const wanted = opts.branded ? 'poster:newobour' : 'poster:unbranded';
  const posterByListing = new Map<string, { branded: string | null; unbranded: string | null }>();
  for (const p of posters) {
    if (!p.ownerId) continue;
    const slot = posterByListing.get(p.ownerId) ?? { branded: null, unbranded: null };
    if (p.stampCategory === wanted) slot.branded = p.path;
    if (p.stampCategory === 'poster:unbranded') slot.unbranded = p.path;
    posterByListing.set(p.ownerId, slot);
  }

  const mapByListing = new Map<string, string | null>();
  for (const m of maps) {
    if (!m.areaId) continue;
    mapByListing.set(m.areaId, (opts.branded ? m.newobourPath || m.cleanPath : m.cleanPath) || null);
  }

  for (const id of ids) {
    const p = posterByListing.get(id);
    out.set(id, {
      posterUrl: (p?.branded ?? p?.unbranded) || null,
      mapUrl: mapByListing.get(id) ?? null,
    });
  }
  return out;
}
