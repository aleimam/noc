import { prisma } from '@noc/db';
import { thumbUrl } from './thumb';

/** Card cover per listing: the annotated location map (plot marked on the masterplan) first —
 *  land plots rarely carry real photos — else the first uploaded photo. Mirrors Al Sawarey's
 *  coversFor so cards never render an empty placeholder when the listing has any image at all.
 *  Covers are returned as 480px WebP thumbnail URLs — the sources are full-size stamped PNGs
 *  (1–2 MB each), far too heavy for card grids on mobile data. */
export async function coversForListings(ids: string[]): Promise<Map<string, string>> {
  const cover = new Map<string, string>();
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return cover;
  const maps = await prisma.areaMap.findMany({
    where: { level: 'listing', areaId: { in: list }, kind: 'location' },
    select: { areaId: true, newobourPath: true, cleanPath: true },
  });
  for (const m of maps) {
    const p = m.newobourPath || m.cleanPath;
    if (m.areaId && p && !cover.has(m.areaId)) cover.set(m.areaId, thumbUrl(p));
  }
  const missing = list.filter((id) => !cover.has(id));
  if (missing.length) {
    const rows = await prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: { in: missing }, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { ownerId: true, path: true },
    });
    for (const r of rows) if (r.ownerId && !cover.has(r.ownerId)) cover.set(r.ownerId, thumbUrl(r.path));
  }
  // Final fallback: the listing's neighborhood masterplan (a generic area map — no plot marker,
  // but far better than a blank card) — covers new listings that have neither a location map nor
  // photos yet, so cards never render an empty placeholder.
  const stillMissing = list.filter((id) => !cover.has(id));
  if (stillMissing.length) {
    const ls = await prisma.listing.findMany({ where: { id: { in: stillMissing } }, select: { id: true, neighborhoodId: true } });
    const nbIds = [...new Set(ls.map((l) => l.neighborhoodId).filter((x): x is string => !!x))];
    if (nbIds.length) {
      const nbMaps = await prisma.areaMap.findMany({
        where: { level: 'neighborhood', areaId: { in: nbIds }, kind: 'masterplan' },
        select: { areaId: true, newobourPath: true, cleanPath: true },
      });
      const byNb = new Map<string, string>();
      for (const m of nbMaps) { const p = m.newobourPath || m.cleanPath; if (m.areaId && p && !byNb.has(m.areaId)) byNb.set(m.areaId, p); }
      for (const l of ls) { const p = l.neighborhoodId ? byNb.get(l.neighborhoodId) : null; if (p && !cover.has(l.id)) cover.set(l.id, thumbUrl(p)); }
    }
  }
  return cover;
}
