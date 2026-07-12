import { prisma } from '@noc/db';
import { getGeoInheritance, type GeoInheritanceMatrix } from './geoInheritance';

export type AdvantageGroup = { title: string; items: string[] };

// Gather the City → District → Neighborhood advantages for a listing, grouped by level
// (each under the area's name). Derived from the listing's neighborhood; returns [] when
// the listing has no neighborhood or no advantages anywhere in the chain.
// Each hop respects the admin inheritance matrix (Setting 'geo.inheritance'):
// advantages.toListing gates the whole block (this loader only feeds listing pages);
// districtToNeighborhood gates the district group; cityToDistrict gates the city group
// (chained — city advantages reach the listing via the district).
export async function advantagesForNeighborhood(
  neighborhoodId: string | null | undefined,
  locale: 'ar' | 'en',
  matrix?: GeoInheritanceMatrix,
): Promise<AdvantageGroup[]> {
  if (!neighborhoodId) return [];
  const m = matrix ?? (await getGeoInheritance());
  if (!m.advantages.toListing) return [];
  const n = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    include: {
      advantages: { orderBy: { order: 'asc' } },
      district: {
        include: {
          advantages: { orderBy: { order: 'asc' } },
          city: { include: { advantages: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  });
  if (!n) return [];
  const L = (ar: string, en: string | null) => (locale === 'ar' ? ar : en || ar);
  const items = (adv: { textAr: string; textEn: string | null }[]) => adv.map((a) => L(a.textAr, a.textEn)).filter(Boolean);

  const groups: AdvantageGroup[] = [];
  const city = n.district.city;
  if (city && m.advantages.districtToNeighborhood && m.advantages.cityToDistrict) {
    groups.push({ title: L(city.nameAr, city.nameEn), items: items(city.advantages) });
  }
  if (m.advantages.districtToNeighborhood) {
    groups.push({ title: L(n.district.nameAr, n.district.nameEn), items: items(n.district.advantages) });
  }
  groups.push({ title: L(n.nameAr, n.nameEn), items: items(n.advantages) });
  return groups.filter((g) => g.items.length > 0);
}
