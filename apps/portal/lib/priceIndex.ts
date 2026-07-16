// Price-index aggregation + monthly snapshots (plain server module — imports only @noc/db
// so ops/price-snapshot.ts can import it with tsx outside Next).
//
// Price basis: everything is normalized to EGP per m².
//   - Listing (PUBLISHED, located): priceUnit TOTAL → price/area; SQM → price as-is;
//     UNIT is skipped (not a land-area price).
//   - Land (PUBLISHED, located, priced): price is a plot total → price/area. Lands linked
//     to a marketplace listing (listingId) are skipped — the listing represents that plot,
//     counting both would double-weight it.
import { prisma } from '@noc/db';

export type DistrictPrice = {
  id: string;
  nameAr: string;
  nameEn: string;
  count: number;
  avgPerM: number; // rounded EGP/m²
  volume: number; // total EGP asking value of the samples
};

type Dist = { id: string; nameAr: string; nameEn: string };

/** Live per-district aggregates from published Listings + Lands, sorted by avgPerM desc. */
export async function computeDistrictPrices(): Promise<DistrictPrice[]> {
  const [listings, lands] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, price: { not: null }, neighborhoodId: { not: null }, priceUnit: { in: ['TOTAL', 'SQM'] } },
      select: {
        price: true, area: true, priceUnit: true,
        neighborhood: { select: { district: { select: { id: true, nameAr: true, nameEn: true } } } },
      },
    }),
    prisma.land.findMany({
      where: { status: 'PUBLISHED', price: { not: null }, area: { not: null }, neighborhoodId: { not: null }, listingId: null },
      select: {
        price: true, area: true,
        neighborhood: { select: { district: { select: { id: true, nameAr: true, nameEn: true } } } },
      },
    }),
  ]);

  type Agg = Dist & { count: number; sumPerM: number; volume: number };
  const byDist = new Map<string, Agg>();
  const add = (d: Dist | null | undefined, perM: number, vol: number) => {
    if (!d || !Number.isFinite(perM) || perM <= 0) return;
    const a = byDist.get(d.id) ?? { ...d, count: 0, sumPerM: 0, volume: 0 };
    a.count++; a.sumPerM += perM; a.volume += vol;
    byDist.set(d.id, a);
  };

  for (const l of listings) {
    const price = Number(l.price), area = l.area ? Number(l.area) : 0;
    if (l.priceUnit === 'SQM') add(l.neighborhood?.district, price, area ? price * area : 0);
    else if (area) add(l.neighborhood?.district, price / area, price);
  }
  for (const l of lands) {
    const price = Number(l.price), area = Number(l.area);
    if (area) add(l.neighborhood?.district, price / area, price);
  }

  return [...byDist.values()]
    .map(({ sumPerM, ...a }) => ({ ...a, avgPerM: Math.round(sumPerM / a.count), volume: Math.round(a.volume) }))
    .sort((x, y) => y.avgPerM - x.avgPerM);
}

/** Current month as "YYYY-MM" (UTC). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Write/overwrite one PriceSnapshot per district-with-data for `month`. Returns rows written. */
export async function snapshotPrices(month = currentMonth()): Promise<number> {
  const dists = await computeDistrictPrices();
  for (const d of dists) {
    const data = { avgPerM: d.avgPerM, listingCount: d.count, volume: d.volume };
    await prisma.priceSnapshot.upsert({
      where: { districtId_month: { districtId: d.id, month } },
      create: { districtId: d.id, month, ...data },
      update: data,
    });
  }
  return dists.length;
}

export type TrendPoint = { month: string; avgPerM: number };

/** Last `months` months of snapshots per district (points sorted oldest→newest). */
export async function loadTrends(months = 6): Promise<Map<string, TrendPoint[]>> {
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - (months - 1));
  const rows = await prisma.priceSnapshot.findMany({
    where: { month: { gte: from.toISOString().slice(0, 7) } }, // "YYYY-MM" compares lexicographically
    select: { districtId: true, month: true, avgPerM: true },
    orderBy: { month: 'asc' },
  });
  const map = new Map<string, TrendPoint[]>();
  for (const r of rows) {
    const arr = map.get(r.districtId) ?? [];
    arr.push({ month: r.month, avgPerM: r.avgPerM });
    map.set(r.districtId, arr);
  }
  return map;
}
