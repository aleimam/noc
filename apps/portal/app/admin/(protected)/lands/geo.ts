import { prisma } from '@noc/db';

export type UpdateRow = {
  id: string;
  title: string | null;
  body: string;
  happenedAt: string;
  notifiedAt: string | null;
  photos: string[];
  author: string | null;
};

/** Load a geographic entity's updates (newest first) with their photo paths. */
export async function loadUpdates(where: {
  districtId?: string;
  neighborhoodId?: string;
  blockId?: string;
  landId?: string;
}): Promise<UpdateRow[]> {
  const updates = await prisma.geoUpdate.findMany({
    where,
    orderBy: { happenedAt: 'desc' },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  const ids = updates.map((u) => u.id);
  const photos = ids.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'GeoUpdate', ownerId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const byUpdate = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.ownerId) continue;
    const arr = byUpdate.get(p.ownerId) ?? [];
    arr.push(p.path);
    byUpdate.set(p.ownerId, arr);
  }
  return updates.map((u) => ({
    id: u.id,
    title: u.title,
    body: u.body,
    happenedAt: u.happenedAt.toISOString(),
    notifiedAt: u.notifiedAt ? u.notifiedAt.toISOString() : null,
    photos: byUpdate.get(u.id) ?? [],
    author: u.createdBy?.name ?? u.createdBy?.email ?? null,
  }));
}

export type MapTriplet = { clean: string; alswarey: string | null; newobour: string | null };

/** The two maps (location + masterplan) for an area, each with its brand copies. */
export async function loadAreaMaps(level: 'district' | 'neighborhood', areaId: string): Promise<{ location: MapTriplet | null; masterplan: MapTriplet | null }> {
  const rows = await prisma.areaMap.findMany({ where: { level, areaId } });
  const pick = (kind: string): MapTriplet | null => {
    const r = rows.find((x) => x.kind === kind);
    return r ? { clean: r.cleanPath, alswarey: r.alswareyPath, newobour: r.newobourPath } : null;
  };
  return { location: pick('location'), masterplan: pick('masterplan') };
}

/** How many distinct followers would a cascade notification reach for this area. */
export async function followerCount(level: 'district' | 'neighborhood', targetId: string): Promise<number> {
  const or: Record<string, unknown>[] = [];
  if (level === 'district') {
    const nIds = (await prisma.neighborhood.findMany({ where: { districtId: targetId }, select: { id: true } })).map((n) => n.id);
    const bIds = nIds.length ? (await prisma.block.findMany({ where: { neighborhoodId: { in: nIds } }, select: { id: true } })).map((b) => b.id) : [];
    const landOr: Record<string, unknown>[] = [];
    if (nIds.length) landOr.push({ neighborhoodId: { in: nIds } });
    if (bIds.length) landOr.push({ blockId: { in: bIds } });
    const lIds = landOr.length ? (await prisma.land.findMany({ where: { OR: landOr }, select: { id: true } })).map((l) => l.id) : [];
    or.push({ districtId: targetId });
    if (nIds.length) or.push({ neighborhoodId: { in: nIds } });
    if (bIds.length) or.push({ blockId: { in: bIds } });
    if (lIds.length) or.push({ landId: { in: lIds } });
  } else {
    const bIds = (await prisma.block.findMany({ where: { neighborhoodId: targetId }, select: { id: true } })).map((b) => b.id);
    const landOr: Record<string, unknown>[] = [{ neighborhoodId: targetId }];
    if (bIds.length) landOr.push({ blockId: { in: bIds } });
    const lIds = (await prisma.land.findMany({ where: { OR: landOr }, select: { id: true } })).map((l) => l.id);
    or.push({ neighborhoodId: targetId });
    if (bIds.length) or.push({ blockId: { in: bIds } });
    if (lIds.length) or.push({ landId: { in: lIds } });
  }
  const follows = await prisma.landFollow.findMany({ where: { OR: or } as never, select: { phone: true } });
  return new Set(follows.map((f) => f.phone)).size;
}

/** Currently-adjacent area ids for the given area. */
export async function loadAdjacency(level: 'district' | 'neighborhood', id: string): Promise<string[]> {
  if (level === 'district') return (await prisma.districtLink.findMany({ where: { fromId: id }, select: { toId: true } })).map((l) => l.toId);
  return (await prisma.neighborhoodLink.findMany({ where: { fromId: id }, select: { toId: true } })).map((l) => l.toId);
}
