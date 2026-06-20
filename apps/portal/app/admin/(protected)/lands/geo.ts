import { prisma } from '@noc/db';

export type UpdateRow = { id: string; body: string; happenedAt: string; photos: string[]; author: string | null };

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
    body: u.body,
    happenedAt: u.happenedAt.toISOString(),
    photos: byUpdate.get(u.id) ?? [],
    author: u.createdBy?.name ?? u.createdBy?.email ?? null,
  }));
}
