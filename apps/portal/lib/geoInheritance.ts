import { prisma } from '@noc/db';

// ── Geo content inheritance matrix ─────────────────────────────────────────────
// Which content categories flow DOWN the geo hierarchy (City → District →
// Neighborhood) and ONTO listing pages. Admin-editable from the Geo Directory hub
// (Setting key 'geo.inheritance'); everything defaults to ON (owner decision).
//
// Limitation: AmenityPlacement has no cityId column, so city-level amenities don't
// exist — 'amenities.cityToDistrict' is stored but has no effect until the schema
// grows one. The matrix still governs district→neighborhood and →listing amenity flow.
//
// NOTE: apps/brokerage/lib/geoInheritance.ts is a deliberate mirror of the read
// side of this module (the brokerage app can't import portal lib) — keep in sync.

export type GeoInheritCategory = 'updates' | 'amenities' | 'advantages' | 'maps';
export type GeoInheritTransition = 'cityToDistrict' | 'districtToNeighborhood' | 'toListing';
export type GeoInheritanceMatrix = Record<GeoInheritCategory, Record<GeoInheritTransition, boolean>>;

export const GEO_INHERITANCE_KEY = 'geo.inheritance';
export const GEO_INHERIT_CATEGORIES = ['updates', 'amenities', 'advantages', 'maps'] as const;
export const GEO_INHERIT_TRANSITIONS = ['cityToDistrict', 'districtToNeighborhood', 'toListing'] as const;

/** All-on defaults (owner picked everything inherited by default). */
export function defaultGeoInheritance(): GeoInheritanceMatrix {
  const m = {} as GeoInheritanceMatrix;
  for (const c of GEO_INHERIT_CATEGORIES) {
    m[c] = { cityToDistrict: true, districtToNeighborhood: true, toListing: true };
  }
  return m;
}

/** Read the matrix from Setting 'geo.inheritance' (JSON), merged over all-true defaults. */
export async function getGeoInheritance(): Promise<GeoInheritanceMatrix> {
  const matrix = defaultGeoInheritance();
  try {
    const row = await prisma.setting.findUnique({ where: { key: GEO_INHERITANCE_KEY } });
    if (!row?.value) return matrix;
    const saved = JSON.parse(row.value) as Partial<Record<string, Partial<Record<string, unknown>>>>;
    for (const c of GEO_INHERIT_CATEGORIES) {
      for (const tr of GEO_INHERIT_TRANSITIONS) {
        const v = saved?.[c]?.[tr];
        if (typeof v === 'boolean') matrix[c][tr] = v;
      }
    }
  } catch {
    // unreadable/legacy JSON → all-on defaults
  }
  return matrix;
}

// ── Updates loaders that APPLY the matrix ──────────────────────────────────────

export type GeoSourceLevel = 'city' | 'district' | 'neighborhood';
export type TaggedUpdate = {
  id: string;
  title: string | null;
  body: string;
  happenedAt: Date;
  source: GeoSourceLevel;
  photos: string[];
};

type RawUpdate = { id: string; title: string | null; body: string; happenedAt: Date; cityId: string | null; districtId: string | null };

async function withPhotos(rows: RawUpdate[]): Promise<TaggedUpdate[]> {
  const ids = rows.map((u) => u.id);
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
  return rows.map((u) => ({
    id: u.id,
    title: u.title,
    body: u.body,
    happenedAt: u.happenedAt,
    source: u.cityId ? 'city' : u.districtId ? 'district' : 'neighborhood',
    photos: byUpdate.get(u.id) ?? [],
  }));
}

const RAW_SELECT = { id: true, title: true, body: true, happenedAt: true, cityId: true, districtId: true } as const;

/** A city's own updates (the top of the chain — nothing to inherit). */
export async function updatesForCity(cityId: string, take = 50): Promise<TaggedUpdate[]> {
  const rows = await prisma.geoUpdate.findMany({ where: { cityId }, orderBy: { happenedAt: 'desc' }, take, select: RAW_SELECT });
  return withPhotos(rows);
}

/** District updates + (per matrix) inherited city updates, newest-first, source-tagged. */
export async function updatesForDistrict(
  districtId: string,
  cityId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
  take = 50,
): Promise<TaggedUpdate[]> {
  const m = matrix ?? (await getGeoInheritance());
  const or: { cityId?: string; districtId?: string; neighborhoodId?: null }[] = [{ districtId, neighborhoodId: null }];
  if (cityId && m.updates.cityToDistrict) or.push({ cityId });
  const rows = await prisma.geoUpdate.findMany({ where: { OR: or }, orderBy: { happenedAt: 'desc' }, take, select: RAW_SELECT });
  return withPhotos(rows);
}

/** Neighborhood updates + (per matrix) district and city updates, newest-first, source-tagged.
 *  City updates only flow through when BOTH hops are on (they inherit via the district). */
export async function updatesForNeighborhood(
  neighborhoodId: string,
  districtId: string,
  cityId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
  take = 50,
): Promise<TaggedUpdate[]> {
  const m = matrix ?? (await getGeoInheritance());
  const or: { cityId?: string; districtId?: string; neighborhoodId?: string }[] = [{ neighborhoodId }];
  if (m.updates.districtToNeighborhood) {
    or.push({ districtId });
    if (cityId && m.updates.cityToDistrict) or.push({ cityId });
  }
  const rows = await prisma.geoUpdate.findMany({ where: { OR: or }, orderBy: { happenedAt: 'desc' }, take, select: RAW_SELECT });
  return withPhotos(rows);
}

// ── Custom area photos that APPLY the 'maps' matrix ────────────────────────────
// Arbitrary branded photos live as extra AreaMap rows (kind 'custom:<id>'). Unlike the
// 4 fixed maps (which only fall back), custom photos inherit ADDITIVELY down the chain,
// exactly like updates: a city's show on its districts/neighborhoods, a district's on its
// neighborhoods — each hop gated by the 'maps' transitions. The area's own photos come first.
export type AreaPhoto = { kind: string; title: string | null; path: string; source: GeoSourceLevel };
const CUSTOM_SELECT = { kind: true, title: true, cleanPath: true, newobourPath: true } as const;
type CustomRow = { kind: string; title: string | null; cleanPath: string; newobourPath: string | null };

function toPhotos(rows: CustomRow[], source: GeoSourceLevel): AreaPhoto[] {
  // Public portal surfaces show the New Obour brand copy (fall back to the clean image).
  return rows
    .filter((r) => r.kind.startsWith('custom:'))
    .map((r) => ({ kind: r.kind, title: r.title, path: r.newobourPath || r.cleanPath, source }));
}
async function customRows(level: GeoSourceLevel, areaId: string): Promise<CustomRow[]> {
  return prisma.areaMap.findMany({ where: { level, areaId }, orderBy: { createdAt: 'asc' }, select: CUSTOM_SELECT });
}

/** A city's own custom photos (top of the chain — nothing to inherit). */
export async function customPhotosForCity(cityId: string): Promise<AreaPhoto[]> {
  return toPhotos(await customRows('city', cityId), 'city');
}

/** A district's own custom photos + (per matrix) inherited city photos, own first. */
export async function customPhotosForDistrict(
  districtId: string,
  cityId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
): Promise<AreaPhoto[]> {
  const m = matrix ?? (await getGeoInheritance());
  const out = toPhotos(await customRows('district', districtId), 'district');
  if (cityId && m.maps.cityToDistrict) out.push(...toPhotos(await customRows('city', cityId), 'city'));
  return out;
}

/** A neighborhood's own custom photos + (per matrix) inherited district & city photos, own first.
 *  City photos only reach here when BOTH hops are on (they arrive via the district). */
export async function customPhotosForNeighborhood(
  neighborhoodId: string,
  districtId: string,
  cityId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
): Promise<AreaPhoto[]> {
  const m = matrix ?? (await getGeoInheritance());
  const out = toPhotos(await customRows('neighborhood', neighborhoodId), 'neighborhood');
  if (m.maps.districtToNeighborhood) {
    out.push(...toPhotos(await customRows('district', districtId), 'district'));
    if (cityId && m.maps.cityToDistrict) out.push(...toPhotos(await customRows('city', cityId), 'city'));
  }
  return out;
}

/** Custom area photos for a LISTING page (gated by maps.toListing; chained from the
 *  listing's neighborhood up the hierarchy per the hop toggles). Own (neighborhood) first. */
export async function customPhotosForListing(
  neighborhoodId: string | null | undefined,
  matrix?: GeoInheritanceMatrix,
): Promise<AreaPhoto[]> {
  if (!neighborhoodId) return [];
  const m = matrix ?? (await getGeoInheritance());
  if (!m.maps.toListing) return [];
  const n = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { districtId: true, district: { select: { cityId: true } } },
  });
  if (!n) return [];
  const out = toPhotos(await customRows('neighborhood', neighborhoodId), 'neighborhood');
  if (m.maps.districtToNeighborhood) {
    out.push(...toPhotos(await customRows('district', n.districtId), 'district'));
    if (n.district.cityId && m.maps.cityToDistrict) out.push(...toPhotos(await customRows('city', n.district.cityId), 'city'));
  }
  return out;
}

// ── Fixed area maps for a LISTING page (gated by maps.toListing) ───────────────
// The 4 fixed maps (masterplan / location / services / mainroads) resolved up the listing's
// neighborhood → district → city chain. Unlike custom photos (which inherit ADDITIVELY),
// fixed maps FALL BACK: each kind shows once, from the NEAREST level that has it
// (neighborhood → district → city). The hop toggles decide which parent levels are eligible;
// maps.toListing gates the whole subsection.
export type AreaMapLevel = 'city' | 'district' | 'neighborhood';
export type AreaListingMap = { level: AreaMapLevel; kind: string; title: string | null; path: string };
const FIXED_MAP_KINDS = ['masterplan', 'location', 'services', 'mainroads'];

export async function areaMapsForListing(
  neighborhoodId: string | null | undefined,
  brand: 'newobour' | 'alsawarey',
  matrix?: GeoInheritanceMatrix,
): Promise<AreaListingMap[]> {
  if (!neighborhoodId) return [];
  const m = matrix ?? (await getGeoInheritance());
  if (!m.maps.toListing) return [];
  const n = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { districtId: true, district: { select: { cityId: true } } },
  });
  if (!n) return [];
  // Eligible levels, NEAREST first (the fallback order for a given kind). City maps only
  // reach here when BOTH hops are on (they arrive via the district).
  const levels: { level: AreaMapLevel; areaId: string }[] = [{ level: 'neighborhood', areaId: neighborhoodId }];
  if (m.maps.districtToNeighborhood) {
    levels.push({ level: 'district', areaId: n.districtId });
    if (n.district.cityId && m.maps.cityToDistrict) levels.push({ level: 'city', areaId: n.district.cityId });
  }
  const rows = await prisma.areaMap.findMany({
    where: { kind: { in: FIXED_MAP_KINDS }, OR: levels.map((l) => ({ level: l.level, areaId: l.areaId })) },
    select: { level: true, areaId: true, kind: true, title: true, cleanPath: true, newobourPath: true, alswareyPath: true },
  });
  const out: AreaListingMap[] = [];
  const seen = new Set<string>(); // one map per kind — nearest level wins
  for (const { level, areaId } of levels) {
    for (const kind of FIXED_MAP_KINDS) {
      if (seen.has(kind)) continue;
      const r = rows.find((x) => x.level === level && x.areaId === areaId && x.kind === kind);
      if (!r) continue;
      seen.add(kind);
      const path = (brand === 'alsawarey' ? r.alswareyPath : r.newobourPath) || r.cleanPath;
      out.push({ level, kind, title: r.title, path });
    }
  }
  return out;
}

/** Area updates for a LISTING page (gated by updates.toListing; chained per the hop
 *  toggles from the listing's neighborhood). Lean rows — title + date, no photos. */
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
  const rows = await prisma.geoUpdate.findMany({ where: { OR: or }, orderBy: { happenedAt: 'desc' }, take, select: RAW_SELECT });
  return rows.map((u) => ({
    id: u.id,
    title: u.title,
    body: u.body,
    happenedAt: u.happenedAt,
    source: u.cityId ? 'city' : u.districtId ? 'district' : 'neighborhood',
    photos: [],
  }));
}
