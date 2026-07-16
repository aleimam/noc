import { prisma, type Prisma } from '@noc/db';
import { newObourVisibility } from '@noc/partner-portal/visibility';
import { marketHref } from './listings';
import { coversForListings } from './listingCovers';

export type AreaListingCard = { id: string; href: string; title: string; price: string | null; typeAr: string; typeEn: string; cover: string | null };

/** Published New Obour listings within a district/neighborhood, shaped for ListingCard. */
export async function areaListings(where: Prisma.ListingWhereInput): Promise<AreaListingCard[]> {
  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', ...newObourVisibility(), ...where },
    orderBy: { publishedAt: 'desc' },
    take: 24,
    select: { id: true, title: true, price: true, adNumber: true, area: true, typeOption: { select: { nameAr: true, nameEn: true } } },
  });
  const ids = listings.map((l) => l.id);
  // Cover chain (location map → photo) — plot listings have maps, not photos.
  const cover = await coversForListings(ids);
  return listings.map((l) => ({
    id: l.id,
    href: marketHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null }),
    title: l.title,
    price: l.price != null ? Number(l.price).toLocaleString('en-US') : null,
    typeAr: l.typeOption?.nameAr ?? '',
    typeEn: l.typeOption?.nameEn ?? '',
    cover: cover.get(l.id) ?? null,
  }));
}
