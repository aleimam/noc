// Storefront land queries. Owner identity is NEVER selected here — visitors see every
// land as "ours" (alsawarey decision #17). Management lives in the New Obour backend.
import { prisma, Prisma } from '@noc/db';
import { AREA_PRESETS, formatDetailValue, type DetailConfig } from '@noc/config';

/** Admin-editable standard plot areas (m²) used to round Allocated-Area details. */
async function getStandardAreas(): Promise<number[]> {
  const row = await prisma.setting.findFirst({ where: { key: 'marketplace.standardAreas' } });
  if (row?.value) {
    try {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) {
        const nums = arr.map(Number).filter((n) => Number.isFinite(n) && n > 0);
        if (nums.length) return nums;
      }
    } catch {
      /* fall through */
    }
  }
  return [...AREA_PRESETS];
}

export type LandCard = {
  id: string;
  title: string;
  typeAr: string | null;
  typeEn: string | null;
  price: number | null;
  soldPrice: number | null;
  status: string;
  cover: string | null;
  area: number | null;
  cityAr: string | null;
  districtAr: string | null;
  corner: boolean;
  onMainStreet: boolean;
  adNumber: string | null;
  featured: boolean;
};

// Attribute keys we surface on cards / filters.
export const ATTR = {
  area: 'land_area',
  areaPreset: 'area_preset',
  corner: 'corner',
  mainStreet: 'on_main_street',
  district: 'district',
  city: 'city',
  price: 'price_total',
} as const;

type ValueRow = {
  number: Prisma.Decimal | null;
  bool: boolean | null;
  text: string | null;
  attribute: { key: string };
  option: { labelAr: string; labelEn: string } | null;
};

function resolve(values: ValueRow[]) {
  const by = new Map<string, ValueRow>();
  for (const v of values) by.set(v.attribute.key, v);
  const num = (k: string) => {
    const v = by.get(k);
    return v?.number != null ? Number(v.number) : null;
  };
  const bool = (k: string) => by.get(k)?.bool === true;
  const optAr = (k: string) => by.get(k)?.option?.labelAr ?? null;
  return {
    area: num(ATTR.area),
    corner: bool(ATTR.corner),
    onMainStreet: bool(ATTR.mainStreet),
    districtAr: optAr(ATTR.district),
    cityAr: optAr(ATTR.city),
  };
}

const cardSelect = {
  id: true,
  title: true,
  price: true,
  soldPrice: true,
  status: true,
  adNumber: true,
  featured: true,
  typeOption: { select: { nameAr: true, nameEn: true } },
  values: {
    select: {
      number: true,
      bool: true,
      text: true,
      attribute: { select: { key: true } },
      option: { select: { labelAr: true, labelEn: true } },
    },
  },
} satisfies Prisma.ListingSelect;

async function coversFor(ids: string[]): Promise<Map<string, string>> {
  const cover = new Map<string, string>();
  if (!ids.length) return cover;
  // Catalogue cover = the listing's own annotated location map (plot marked).
  const maps = await prisma.areaMap.findMany({
    where: { level: 'listing', areaId: { in: ids }, kind: 'location' },
    select: { areaId: true, alswareyPath: true, cleanPath: true },
  });
  for (const m of maps) {
    const p = m.alswareyPath || m.cleanPath;
    if (m.areaId && p && !cover.has(m.areaId)) cover.set(m.areaId, p);
  }
  // Fall back to the first uploaded photo for any listing without a location map.
  const missing = ids.filter((id) => !cover.has(id));
  if (missing.length) {
    const rows = await prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: { in: missing }, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { ownerId: true, path: true },
    });
    for (const r of rows) if (r.ownerId && !cover.has(r.ownerId)) cover.set(r.ownerId, r.path);
  }
  return cover;
}

function toCard(l: Prisma.ListingGetPayload<{ select: typeof cardSelect }>, cover: Map<string, string>): LandCard {
  const r = resolve(l.values as ValueRow[]);
  return {
    id: l.id,
    title: l.title,
    typeAr: l.typeOption?.nameAr ?? null,
    typeEn: l.typeOption?.nameEn ?? null,
    price: l.price != null ? Number(l.price) : null,
    soldPrice: l.soldPrice != null ? Number(l.soldPrice) : null,
    status: l.status,
    cover: cover.get(l.id) ?? null,
    area: r.area,
    cityAr: r.cityAr,
    districtAr: r.districtAr,
    corner: r.corner,
    onMainStreet: r.onMainStreet,
    adNumber: l.adNumber ?? null,
    featured: l.featured,
  };
}

// Listings visible on the storefront: published (available) or sold — both shown publicly.
// Also limited to Types/Purposes still allowed on Al Sawarey (null = legacy/unset → allowed),
// so disallowing a Type/Purpose in the admin instantly hides its listings here.
const STOREFRONT_STATUS: Prisma.ListingWhereInput = {
  showOnBrokerage: true,
  status: { in: ['PUBLISHED', 'SOLD'] },
  AND: [
    { OR: [{ typeOptionId: null }, { typeOption: { allowedOnAlsawarey: true } }] },
    { OR: [{ purposeOptionId: null }, { purposeOption: { allowedOnAlsawarey: true } }] },
  ],
};

export async function latestLands(take = 6): Promise<LandCard[]> {
  const rows = await prisma.listing.findMany({
    where: STOREFRONT_STATUS,
    orderBy: [{ featured: 'desc' }, { status: 'asc' }, { publishedAt: 'desc' }],
    take,
    select: cardSelect,
  });
  const cover = await coversFor(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, cover));
}

/** Promoted lands for the home "featured" row (available only). */
export async function featuredLands(take = 8): Promise<LandCard[]> {
  const rows = await prisma.listing.findMany({
    where: { ...STOREFRONT_STATUS, status: 'PUBLISHED', featured: true },
    orderBy: { publishedAt: 'desc' },
    take,
    select: cardSelect,
  });
  const cover = await coversFor(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, cover));
}

export type LandDetail = {
  id: string;
  adNumber: string | null;
  title: string;
  description: string | null;
  actualArea: number | null; // fixed Listing.area (المساحة الفعلية)
  price: number | null;
  priceUnit: string;
  priceNegotiable: boolean;
  soldPrice: number | null;
  priceNote: string | null;
  status: string;
  typeAr: string | null;
  locationMap: string | null; // the listing's OWN annotated location map (plot marked)
  gallery: string[];
  specs: { label: string; value: string; link?: 'url' | 'tel'; sectionAr: string; sectionEn: string; sectionOrder: number; attrOrder: number }[]; // public attributes, localized
  amenities: { type: string; title: string; details: string | null; photos: string[] }[]; // inherited from the neighborhood
  conditions: { slug: string; title: string; body: string }[]; // attached building-conditions pages
};

export async function getLandDetail(id: string, locale: 'ar' | 'en'): Promise<LandDetail | null> {
  const l = await prisma.listing.findFirst({
    where: { id, ...STOREFRONT_STATUS },
    select: {
      id: true,
      adNumber: true,
      neighborhoodId: true,
      title: true,
      description: true,
      area: true,
      price: true,
      priceUnit: true,
      priceNegotiable: true,
      soldPrice: true,
      priceNote: true,
      status: true,
      typeOption: { select: { nameAr: true, nameEn: true } },
      buildingConditions: { select: { condition: { select: { slug: true, titleAr: true, titleEn: true, bodyAr: true, bodyEn: true } } } },
      values: {
        select: {
          number: true,
          bool: true,
          text: true,
          attribute: { select: { key: true, labelAr: true, labelEn: true, unit: true, type: true, config: true, order: true, isActive: true, section: { select: { nameAr: true, nameEn: true, order: true } } } },
          option: { select: { labelAr: true, labelEn: true } },
          listItem: { select: { labelAr: true, labelEn: true } },
        },
      },
    },
  });
  if (!l) return null;

  const gallery = (
    await prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: id, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { path: true },
    })
  ).map((a) => a.path);

  // The listing's OWN annotated location map (the plot marked on the masterplan) — the
  // accurate map for this land. Show it first in the gallery and in its own section.
  const locMap = await prisma.areaMap.findFirst({
    where: { level: 'listing', areaId: id, kind: 'location' },
    select: { alswareyPath: true, cleanPath: true },
  });
  const locationMap = locMap ? locMap.alswareyPath || locMap.cleanPath : null;
  if (locationMap) gallery.unshift(locationMap);
  // Only the listing's own annotated location map is shown — the raw neighborhood/district
  // masterplans are deliberately NOT added to the gallery (owner request 2026-07-09).

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const standardAreas = await getStandardAreas();

  // Resolve DISTRICT / NEIGHBORHOOD detail values (stored as geo ids) to localized names.
  const geoIds = l.values
    .filter((v) => (v.attribute.type === 'DISTRICT' || v.attribute.type === 'NEIGHBORHOOD') && v.text)
    .map((v) => v.text as string);
  const geoName = new Map<string, { ar: string; en: string }>();
  if (geoIds.length) {
    const [ds, ns] = await Promise.all([
      prisma.district.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.neighborhood.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true, nameEn: true } }),
    ]);
    for (const g of [...ds, ...ns]) geoName.set(g.id, { ar: g.nameAr, en: g.nameEn });
  }

  const specs: LandDetail['specs'] = [];
  for (const v of l.values) {
    if (!v.attribute.isActive) continue;
    const label = L(v.attribute.labelAr, v.attribute.labelEn);
    const geo = (v.attribute.type === 'DISTRICT' || v.attribute.type === 'NEIGHBORHOOD') && v.text ? geoName.get(v.text) : null;
    const value = geo
      ? L(geo.ar, geo.en)
      : v.listItem
      ? L(v.listItem.labelAr, v.listItem.labelEn)
      : v.option
      ? L(v.option.labelAr, v.option.labelEn)
      : formatDetailValue({
          type: v.attribute.type,
          unit: v.attribute.unit,
          number: v.number != null ? Number(v.number) : null,
          bool: v.bool,
          text: v.text,
          config: v.attribute.config as DetailConfig | null,
          locale,
          standardAreas,
        });
    const link = v.attribute.type === 'URL' ? 'url' : v.attribute.type === 'PHONE' ? 'tel' : undefined;
    if (value)
      specs.push({
        label,
        value,
        link,
        sectionAr: v.attribute.section?.nameAr ?? '',
        sectionEn: v.attribute.section?.nameEn ?? '',
        sectionOrder: v.attribute.section?.order ?? 999,
        attrOrder: v.attribute.order ?? 0,
      });
  }
  specs.sort((a, b) => a.sectionOrder - b.sectionOrder || a.attrOrder - b.attrOrder);

  // Public-realm amenities inherited from the land's neighborhood.
  // Amenities: attached directly to this listing + inherited from its neighborhood + district.
  const amenities: LandDetail['amenities'] = [];
  {
    const nb = l.neighborhoodId ? await prisma.neighborhood.findUnique({ where: { id: l.neighborhoodId }, select: { districtId: true } }) : null;
    const or: Prisma.AmenityPlacementWhereInput[] = [{ listingId: l.id }];
    if (l.neighborhoodId) or.push({ neighborhoodId: l.neighborhoodId });
    if (nb?.districtId) or.push({ districtId: nb.districtId });
    const placements = await prisma.amenityPlacement.findMany({
      where: { OR: or },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { amenity: { include: { category: { select: { labelAr: true, labelEn: true } } } } },
    });
    const seen = new Set<string>();
    const active = placements.map((p) => p.amenity).filter((a) => a.isActive && !seen.has(a.id) && (seen.add(a.id), true));
    const ids = active.map((a) => a.id);
    const ph = ids.length ? await prisma.attachment.findMany({ where: { ownerType: 'Amenity', ownerId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } }) : [];
    const byA = new Map<string, string[]>();
    for (const p of ph) {
      if (!p.ownerId) continue;
      const arr = byA.get(p.ownerId) ?? [];
      arr.push(p.path);
      byA.set(p.ownerId, arr);
    }
    for (const a of active) {
      amenities.push({
        type: a.category ? L(a.category.labelAr, a.category.labelEn) : '',
        title: L(a.titleAr, a.titleEn || a.titleAr),
        details: locale === 'ar' ? a.detailsAr : a.detailsEn || a.detailsAr,
        photos: byA.get(a.id) ?? [],
      });
    }
  }

  return {
    id: l.id,
    adNumber: l.adNumber ?? null,
    title: l.title,
    description: l.description,
    actualArea: l.area != null ? Number(l.area) : null,
    price: l.price != null ? Number(l.price) : null,
    priceUnit: l.priceUnit,
    priceNegotiable: l.priceNegotiable,
    soldPrice: l.soldPrice != null ? Number(l.soldPrice) : null,
    priceNote: l.priceNote,
    status: l.status,
    typeAr: locale === 'ar' ? l.typeOption?.nameAr ?? null : l.typeOption?.nameEn ?? null,
    locationMap,
    gallery,
    specs,
    amenities,
    conditions: l.buildingConditions.map((b) => ({
      slug: b.condition.slug,
      title: L(b.condition.titleAr, b.condition.titleEn || b.condition.titleAr),
      body: locale === 'en' ? b.condition.bodyEn || b.condition.bodyAr : b.condition.bodyAr,
    })),
  };
}

export async function listLands(
  opts: { where?: Prisma.ListingWhereInput; orderBy?: Prisma.ListingOrderByWithRelationInput[]; take?: number; skip?: number } = {},
): Promise<{ cards: LandCard[]; total: number }> {
  const where: Prisma.ListingWhereInput = { AND: [STOREFRONT_STATUS, opts.where ?? {}] };
  const orderBy = opts.orderBy ?? [{ featured: 'desc' }, { status: 'asc' }, { publishedAt: 'desc' }];
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, take: opts.take ?? 24, skip: opts.skip ?? 0, select: cardSelect }),
    prisma.listing.count({ where }),
  ]);
  const cover = await coversFor(rows.map((r) => r.id));
  return { cards: rows.map((r) => toCard(r, cover)), total };
}

/** Recently sold lands (social proof on the home page). */
export async function recentlySold(take = 6): Promise<LandCard[]> {
  const rows = await prisma.listing.findMany({
    where: { ...STOREFRONT_STATUS, status: 'SOLD' },
    orderBy: { updatedAt: 'desc' },
    take,
    select: cardSelect,
  });
  const cover = await coversFor(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, cover));
}

/** Lands similar to the given one — same district + similar area, available only. */
export async function similarLands(listingId: string, take = 4): Promise<LandCard[]> {
  const base = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { values: { select: { number: true, attribute: { select: { key: true } }, optionId: true } } },
  });
  let area: number | null = null;
  let districtOptionId: string | null = null;
  for (const v of base?.values ?? []) {
    if (v.attribute.key === ATTR.area && v.number != null) area = Number(v.number);
    if (v.attribute.key === ATTR.district && v.optionId) districtOptionId = v.optionId;
  }
  const and: Prisma.ListingWhereInput[] = [{ id: { not: listingId } }];
  if (districtOptionId) and.push({ values: { some: { attribute: { key: ATTR.district }, optionId: districtOptionId } } });
  if (area != null) and.push({ values: { some: { attribute: { key: ATTR.area }, number: { gte: area * 0.7, lte: area * 1.3 } } } });

  const rows = await prisma.listing.findMany({
    where: { AND: [{ ...STOREFRONT_STATUS, status: 'PUBLISHED' }, ...and] },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take,
    select: cardSelect,
  });
  const cover = await coversFor(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, cover));
}

/** Cards for an explicit set of ids (compare view), keeping the storefront visibility rule. */
export async function landsByIds(ids: string[]): Promise<LandCard[]> {
  if (!ids.length) return [];
  const rows = await prisma.listing.findMany({ where: { id: { in: ids }, ...STOREFRONT_STATUS }, select: cardSelect });
  const cover = await coversFor(rows.map((r) => r.id));
  const map = new Map(rows.map((r) => [r.id, toCard(r, cover)]));
  return ids.map((id) => map.get(id)).filter((x): x is LandCard => !!x);
}
