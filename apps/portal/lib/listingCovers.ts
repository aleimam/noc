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
  return cover;
}
