import { prisma, Prisma } from '@noc/db';

// Reusable amenity library + placement helpers. An amenity is built once and attached to
// neighborhoods / districts / listings; public surfaces gather by inheritance:
//   neighborhood → its own placements + its district's
//   district     → its own placements
//   listing      → its own + its neighborhood's + its district's

export type AmenityCard = {
  id: string;
  category: { ar: string; en: string } | null;
  titleAr: string;
  titleEn: string | null;
  detailsAr: string | null;
  detailsEn: string | null;
  photos: string[];
};

async function loadCards(where: Prisma.AmenityPlacementWhereInput): Promise<AmenityCard[]> {
  const placements = await prisma.amenityPlacement.findMany({
    where,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { amenity: { include: { category: { select: { labelAr: true, labelEn: true } } } } },
  });
  const seen = new Set<string>();
  const amenities = placements
    .map((p) => p.amenity)
    .filter((a) => a.isActive && !seen.has(a.id) && (seen.add(a.id), true));

  const ids = amenities.map((a) => a.id);
  const photos = ids.length
    ? await prisma.attachment.findMany({ where: { ownerType: 'Amenity', ownerId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } })
    : [];
  const byA = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.ownerId) continue;
    const arr = byA.get(p.ownerId) ?? [];
    arr.push(p.path);
    byA.set(p.ownerId, arr);
  }
  return amenities.map((a) => ({
    id: a.id,
    category: a.category ? { ar: a.category.labelAr, en: a.category.labelEn } : null,
    titleAr: a.titleAr,
    titleEn: a.titleEn,
    detailsAr: a.detailsAr,
    detailsEn: a.detailsEn,
    photos: byA.get(a.id) ?? [],
  }));
}

export function amenitiesForNeighborhood(neighborhoodId: string, districtId: string | null) {
  const or: Prisma.AmenityPlacementWhereInput[] = [{ neighborhoodId }];
  if (districtId) or.push({ districtId });
  return loadCards({ OR: or });
}

export function amenitiesForDistrict(districtId: string) {
  return loadCards({ districtId });
}

export function amenitiesForListing(listingId: string, neighborhoodId: string | null, districtId: string | null) {
  const or: Prisma.AmenityPlacementWhereInput[] = [{ listingId }];
  if (neighborhoodId) or.push({ neighborhoodId });
  if (districtId) or.push({ districtId });
  return loadCards({ OR: or });
}

// ── Admin helpers ──

/** Every amenity in the library (active + inactive) for the admin library page. */
export async function listLibraryAmenities() {
  const [amenities, photos, placements] = await Promise.all([
    prisma.amenity.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { category: { select: { labelAr: true, labelEn: true } } } }),
    prisma.attachment.findMany({ where: { ownerType: 'Amenity' }, orderBy: { createdAt: 'asc' }, select: { id: true, ownerId: true, path: true } }),
    prisma.amenityPlacement.groupBy({ by: ['amenityId'], _count: { amenityId: true } }),
  ]);
  const photoBy = new Map<string, { id: string; path: string }[]>();
  for (const p of photos) {
    if (!p.ownerId) continue;
    const arr = photoBy.get(p.ownerId) ?? [];
    arr.push({ id: p.id, path: p.path });
    photoBy.set(p.ownerId, arr);
  }
  const placeBy = new Map(placements.map((p) => [p.amenityId, p._count.amenityId]));
  return amenities.map((a) => ({
    id: a.id,
    categoryItemId: a.categoryItemId,
    category: a.category ? { ar: a.category.labelAr, en: a.category.labelEn } : null,
    titleAr: a.titleAr,
    titleEn: a.titleEn,
    detailsAr: a.detailsAr,
    detailsEn: a.detailsEn,
    isActive: a.isActive,
    photos: photoBy.get(a.id) ?? [],
    placementCount: placeBy.get(a.id) ?? 0,
  }));
}

/** Amenity ids already attached to a place — for the attach picker's initial state. */
export async function placedAmenityIds(scope: 'neighborhood' | 'district' | 'listing', scopeId: string): Promise<string[]> {
  const where =
    scope === 'neighborhood' ? { neighborhoodId: scopeId } : scope === 'district' ? { districtId: scopeId } : { listingId: scopeId };
  const rows = await prisma.amenityPlacement.findMany({ where, select: { amenityId: true } });
  return rows.map((r) => r.amenityId);
}

/** Active amenities as pick options (id + localized label + category) for the attach picker. */
export async function amenityPickOptions(locale: 'ar' | 'en') {
  const rows = await prisma.amenity.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { category: { select: { labelAr: true, labelEn: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    label: locale === 'en' ? a.titleEn || a.titleAr : a.titleAr,
    category: a.category ? (locale === 'en' ? a.category.labelEn || a.category.labelAr : a.category.labelAr) : '',
  }));
}
