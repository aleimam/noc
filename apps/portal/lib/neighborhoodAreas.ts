import { prisma } from '@noc/db';
import { roundToStandardArea } from '@noc/config';
import { getStandardAreas } from './marketplace';

// A neighborhood's "available standard areas" are the manually-curated `Neighborhood.areas`
// MERGED with the sizes of the plots (listings) placed in that neighborhood. The owner's rule
// (2026-07-15): every plot added to a neighborhood contributes its standard/allocated size to
// that neighborhood's area list. Only PUBLISHED + SOLD plots count (drafts / pending / rejected
// / archived do not). Computed live at read time — no schema column, always current.

// Per plot the representative size is «أصل المساحة» (the allocated/standard size, `original_area`)
// when present, otherwise the actual area (`Listing.area` column, or the EAV `area` value on older
// rows) rounded to the nearest configured standard bucket.

/** Plot-derived standard areas per neighborhood: Map<neighborhoodId, sorted-unique number[]>. */
export async function derivePlotAreas(neighborhoodIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const ids = [...new Set(neighborhoodIds.filter(Boolean))];
  if (!ids.length) return out;

  const areaAttrs = await prisma.attribute.findMany({
    where: { key: { in: ['original_area', 'area'] } },
    select: { id: true, key: true },
  });
  const origId = areaAttrs.find((a) => a.key === 'original_area')?.id;
  const areaId = areaAttrs.find((a) => a.key === 'area')?.id;
  const attrIds = [origId, areaId].filter((x): x is string => !!x);

  const [standardAreas, listings] = await Promise.all([
    getStandardAreas(),
    prisma.listing.findMany({
      where: { neighborhoodId: { in: ids }, status: { in: ['PUBLISHED', 'SOLD'] } },
      select: {
        neighborhoodId: true,
        area: true,
        values: attrIds.length
          ? { where: { attributeId: { in: attrIds } }, select: { attributeId: true, number: true } }
          : { where: { id: '' }, select: { attributeId: true, number: true } },
      },
    }),
  ]);

  const sets = new Map<string, Set<number>>();
  for (const l of listings) {
    if (!l.neighborhoodId) continue;
    const origVal = origId ? l.values.find((v) => v.attributeId === origId)?.number : null;
    const areaEav = areaId ? l.values.find((v) => v.attributeId === areaId)?.number : null;
    const orig = origVal != null ? Number(origVal) : NaN;
    const actual = l.area != null ? Number(l.area) : areaEav != null ? Number(areaEav) : NaN;

    let std: number;
    if (Number.isFinite(orig) && orig > 0) std = orig; // أصل المساحة is already the standard/allocated size
    else if (Number.isFinite(actual) && actual > 0) std = roundToStandardArea(actual, standardAreas);
    else continue;
    std = Math.round(std * 100) / 100;
    if (!Number.isFinite(std) || std <= 0) continue;

    let s = sets.get(l.neighborhoodId);
    if (!s) { s = new Set(); sets.set(l.neighborhoodId, s); }
    s.add(std);
  }
  for (const [nbId, s] of sets) out.set(nbId, [...s].sort((a, b) => a - b));
  return out;
}

/** Union of manual + plot-derived areas, unique and ascending. */
export function mergeAreas(manual: number[] | null | undefined, derived: number[] | null | undefined): number[] {
  const s = new Set<number>();
  for (const a of manual ?? []) if (typeof a === 'number' && Number.isFinite(a) && a > 0) s.add(a);
  for (const a of derived ?? []) if (typeof a === 'number' && Number.isFinite(a) && a > 0) s.add(a);
  return [...s].sort((a, b) => a - b);
}
