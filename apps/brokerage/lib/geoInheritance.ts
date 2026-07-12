import { prisma } from '@noc/db';

// ── Geo content inheritance matrix (read side) ────────────────────────────────
// Deliberate mirror of apps/portal/lib/geoInheritance.ts — the brokerage app can't
// import portal lib (advantages.ts pattern). The matrix is edited ONLY from the
// portal admin (Geo Directory hub) and stored in Setting 'geo.inheritance'; here we
// just read it to gate what area content shows on alsawarey.com listing pages.

export type GeoInheritCategory = 'updates' | 'amenities' | 'advantages' | 'maps';
export type GeoInheritTransition = 'cityToDistrict' | 'districtToNeighborhood' | 'toListing';
export type GeoInheritanceMatrix = Record<GeoInheritCategory, Record<GeoInheritTransition, boolean>>;

const GEO_INHERITANCE_KEY = 'geo.inheritance';
const CATEGORIES = ['updates', 'amenities', 'advantages', 'maps'] as const;
const TRANSITIONS = ['cityToDistrict', 'districtToNeighborhood', 'toListing'] as const;

function defaults(): GeoInheritanceMatrix {
  const m = {} as GeoInheritanceMatrix;
  for (const c of CATEGORIES) m[c] = { cityToDistrict: true, districtToNeighborhood: true, toListing: true };
  return m;
}

/** Read the matrix from Setting 'geo.inheritance' (JSON), merged over all-true defaults. */
export async function getGeoInheritance(): Promise<GeoInheritanceMatrix> {
  const matrix = defaults();
  try {
    const row = await prisma.setting.findUnique({ where: { key: GEO_INHERITANCE_KEY } });
    if (!row?.value) return matrix;
    const saved = JSON.parse(row.value) as Partial<Record<string, Partial<Record<string, unknown>>>>;
    for (const c of CATEGORIES) {
      for (const tr of TRANSITIONS) {
        const v = saved?.[c]?.[tr];
        if (typeof v === 'boolean') matrix[c][tr] = v;
      }
    }
  } catch {
    // unreadable/legacy JSON → all-on defaults
  }
  return matrix;
}

export type TaggedUpdate = { id: string; title: string | null; happenedAt: Date; source: 'city' | 'district' | 'neighborhood' };

/** Latest area updates for a LISTING page (gated by updates.toListing; chained per the
 *  hop toggles from the listing's neighborhood). Lean rows — title + date only. */
export async function updatesForListing(
  neighborhoodId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
  take = 5,
): Promise<TaggedUpdate[]> {
  if (!neighborhoodId) return [];
  const m = matrix ?? (await getGeoInheritance());
  if (!m.updates.toListing) return [];
  const n = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { districtId: true, district: { select: { cityId: true } } },
  });
  if (!n) return [];
  const or: { cityId?: string; districtId?: string; neighborhoodId?: string }[] = [{ neighborhoodId }];
  if (m.updates.districtToNeighborhood) {
    or.push({ districtId: n.districtId });
    if (n.district.cityId && m.updates.cityToDistrict) or.push({ cityId: n.district.cityId });
  }
  const rows = await prisma.geoUpdate.findMany({
    where: { OR: or },
    orderBy: { happenedAt: 'desc' },
    take,
    select: { id: true, title: true, happenedAt: true, cityId: true, districtId: true },
  });
  return rows.map((u) => ({
    id: u.id,
    title: u.title,
    happenedAt: u.happenedAt,
    source: u.cityId ? 'city' : u.districtId ? 'district' : 'neighborhood',
  }));
}
