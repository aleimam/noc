import { prisma, type Prisma } from '@noc/db';

export type AreaListingCard = { id: string; title: string; price: string | null; typeAr: string; typeEn: string; cover: string | null };

/** Published New Obour listings within a district/neighborhood, shaped for ListingCard. */
export async function areaListings(where: Prisma.ListingWhereInput): Promise<AreaListingCard[]> {
  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', ...where },
    orderBy: { publishedAt: 'desc' },
    take: 24,
    select: { id: true, title: true, price: true, typeOption: { select: { nameAr: true, nameEn: true } } },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length
    ? await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } })
    : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);
  return listings.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price != null ? String(l.price) : null,
    typeAr: l.typeOption?.nameAr ?? '',
    typeEn: l.typeOption?.nameEn ?? '',
    cover: cover.get(l.id) ?? null,
  }));
}
