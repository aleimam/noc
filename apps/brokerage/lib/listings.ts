// Storefront land queries. Owner identity is NEVER selected here — visitors see every
// land as "ours" (alsawarey decision #17). Management lives in the New Obour backend.
import { prisma, Prisma } from '@noc/db';
import { alsawareyVisibility } from '@noc/partner-portal/visibility';
import { AREA_PRESETS, formatDetailValue, type DetailConfig } from '@noc/config';
import { thumbUrl } from './thumb';

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

/** ASCII slug from English text (keywords for SEO-friendly URLs). */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 60);
}

/** SEO-friendly listing path: /listings/<english-slug>-<adNumber>. The ad number (trailing
 *  digits) is the stable lookup key; falls back to the cuid for listings with no ad number. */
export function listingHref(l: { id: string; adNumber: string | null; typeEn: string | null; area: number | null }): string {
  if (!l.adNumber) return `/listings/${l.id}`;
  const slug = slugify([l.typeEn || 'land', l.area ? `${l.area}m` : ''].filter(Boolean).join(' ')) || 'land';
  return `/listings/${slug}-${l.adNumber}`;
}

export type LandCard = {
  id: string;
  href: string; // canonical SEO path
  title: string;
  typeAr: string | null;
  typeEn: string | null;
  price: number | null;
  soldPrice: number | null;
  status: string;
  cover: string | null;
  area: number | null;
  cityAr: string | null;
  cityEn: string | null;
  districtAr: string | null;
  districtEn: string | null;
  /** Geo-hierarchy names (District/Neighborhood) for search — the EAV district/city labels above
   *  don't cover geo-only listings, which made "الحى العاشر" return nothing. Not shown on the card. */
  geoText: string | null;
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
  listItem: { labelAr: string; labelEn: string } | null;
};

function resolve(values: ValueRow[]) {
  const by = new Map<string, ValueRow>();
  for (const v of values) by.set(v.attribute.key, v);
  const num = (k: string) => {
    const v = by.get(k);
    return v?.number != null ? Number(v.number) : null;
  };
  const bool = (k: string) => by.get(k)?.bool === true;
  // SELECT values live in the shared OptionList (`listItem`) since the 2026-07 option-lists
  // migration; pre-migration rows still carry the legacy `option`. Read BOTH — reading only
  // `option` silently dropped city/district from every post-migration card.
  const optAr = (k: string) => by.get(k)?.listItem?.labelAr ?? by.get(k)?.option?.labelAr ?? null;
  const optEn = (k: string) => by.get(k)?.listItem?.labelEn ?? by.get(k)?.option?.labelEn ?? null;
  return {
    area: num(ATTR.area),
    corner: bool(ATTR.corner),
    onMainStreet: bool(ATTR.mainStreet),
    districtAr: optAr(ATTR.district),
    districtEn: optEn(ATTR.district),
    cityAr: optAr(ATTR.city),
    cityEn: optEn(ATTR.city),
  };
}

const cardSelect = {
  id: true,
  title: true,
  price: true,
  soldPrice: true,
  status: true,
  adNumber: true,
  area: true, // Listing.area column — used for the canonical slug (matches the detail page)
  featured: true,
  typeOption: { select: { nameAr: true, nameEn: true } },
  // Geo hierarchy for search (not shown on the card) — see LandCard.geoText.
  neighborhood: { select: { nameAr: true, nameEn: true, district: { select: { nameAr: true, nameEn: true } } } },
  values: {
    select: {
      number: true,
      bool: true,
      text: true,
      attribute: { select: { key: true } },
      option: { select: { labelAr: true, labelEn: true } },
      listItem: { select: { labelAr: true, labelEn: true } },
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
    // 480px WebP thumbnail — the sources are full-size stamped PNGs, too heavy for card grids.
    if (m.areaId && p && !cover.has(m.areaId)) cover.set(m.areaId, thumbUrl(p));
  }
  // Fall back to the first uploaded photo for any listing without a location map.
  const missing = ids.filter((id) => !cover.has(id));
  if (missing.length) {
    const rows = await prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: { in: missing }, attributeId: null },
      orderBy: { createdAt: 'asc' },
      select: { ownerId: true, path: true },
    });
    for (const r of rows) if (r.ownerId && !cover.has(r.ownerId)) cover.set(r.ownerId, thumbUrl(r.path));
  }
  // Final fallback: the listing's neighborhood masterplan (a generic area map — no plot marker,
  // but far better than a blank card) — covers new listings that have neither a location map nor
  // photos yet, so cards never render an empty placeholder.
  const stillMissing = ids.filter((id) => !cover.has(id));
  if (stillMissing.length) {
    const ls = await prisma.listing.findMany({ where: { id: { in: stillMissing } }, select: { id: true, neighborhoodId: true } });
    const nbIds = [...new Set(ls.map((l) => l.neighborhoodId).filter((x): x is string => !!x))];
    if (nbIds.length) {
      const nbMaps = await prisma.areaMap.findMany({
        where: { level: 'neighborhood', areaId: { in: nbIds }, kind: 'masterplan' },
        select: { areaId: true, alswareyPath: true, cleanPath: true },
      });
      const byNb = new Map<string, string>();
      for (const m of nbMaps) { const p = m.alswareyPath || m.cleanPath; if (m.areaId && p && !byNb.has(m.areaId)) byNb.set(m.areaId, p); }
      for (const l of ls) { const p = l.neighborhoodId ? byNb.get(l.neighborhoodId) : null; if (p && !cover.has(l.id)) cover.set(l.id, thumbUrl(p)); }
    }
  }
  return cover;
}

function toCard(l: Prisma.ListingGetPayload<{ select: typeof cardSelect }>, cover: Map<string, string>): LandCard {
  const r = resolve(l.values as ValueRow[]);
  return {
    id: l.id,
    href: listingHref({ id: l.id, adNumber: l.adNumber ?? null, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null }),
    title: l.title,
    typeAr: l.typeOption?.nameAr ?? null,
    typeEn: l.typeOption?.nameEn ?? null,
    price: l.price != null && Number(l.price) > 0 ? Number(l.price) : null, // 0/blank ⇒ «السعر عند الطلب»
    soldPrice: l.soldPrice != null && Number(l.soldPrice) > 0 ? Number(l.soldPrice) : null, // 0 ⇒ «تم البيع» without a figure
    status: l.status,
    cover: cover.get(l.id) ?? null,
    area: r.area,
    cityAr: r.cityAr,
    cityEn: r.cityEn,
    districtAr: r.districtAr,
    districtEn: r.districtEn,
    geoText: [l.neighborhood?.district?.nameAr, l.neighborhood?.district?.nameEn, l.neighborhood?.nameAr, l.neighborhood?.nameEn].filter(Boolean).join(' ') || null,
    corner: r.corner,
    onMainStreet: r.onMainStreet,
    adNumber: l.adNumber ?? null,
    featured: l.featured,
  };
}

// Listings visible on the storefront: published (available) or sold — both shown publicly.
// Also limited to Types/Purposes still allowed on Al Sawarey (null = legacy/unset → allowed),
// so disallowing a Type/Purpose in the admin instantly hides its listings here.
export const STOREFRONT_STATUS: Prisma.ListingWhereInput = {
  status: { in: ['PUBLISHED', 'SOLD'] },
  AND: [
    { OR: [{ typeOptionId: null }, { typeOption: { allowedOnAlsawarey: true } }] },
    { OR: [{ purposeOptionId: null }, { purposeOption: { allowedOnAlsawarey: true } }] },
    // Phase 4 — partner listings appear only where their partner is enabled for Al Sawarey;
    // staff/non-partner listings keep the per-listing `showOnBrokerage` toggle.
    alsawareyVisibility(),
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
  canonicalPath: string; // SEO-friendly /listings/<slug>-<adNumber>
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

/** Resolve a /listings/<param> segment to a listing id — the param is either the SEO slug
 *  ending in the ad number (…-2607002) or a legacy cuid. */
export async function resolveListingId(param: string): Promise<string | null> {
  const dec = decodeURIComponent(param).trim();
  const tail = dec.split('-').pop() ?? '';
  const where = /^\d+$/.test(tail) ? { adNumber: tail } : { id: dec };
  const found = await prisma.listing.findFirst({ where: { ...where, ...STOREFRONT_STATUS }, select: { id: true } });
  return found?.id ?? null;
}

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
          attribute: { select: { key: true, labelAr: true, labelEn: true, unit: true, type: true, config: true, order: true, isActive: true, section: { select: { key: true, nameAr: true, nameEn: true, order: true } } } },
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

  // Advantages sections list only POSITIVE advantages, so a boolean advantage set to false (the
  // absence of an advantage) is dropped — mirrors the New Obour market page (owner rule 2026-07-23).
  const ADVANTAGE_SECTION_KEYS = new Set(['location-pros', 'advantages']);
  const specs: LandDetail['specs'] = [];
  for (const v of l.values) {
    if (!v.attribute.isActive) continue;
    if (ADVANTAGE_SECTION_KEYS.has(v.attribute.section?.key ?? '') && (v.attribute.type === 'BOOLEAN' || v.attribute.type === 'YESNO') && v.bool !== true) continue;
    const label = L(v.attribute.labelAr, v.attribute.labelEn);
    const isGeo = v.attribute.type === 'DISTRICT' || v.attribute.type === 'NEIGHBORHOOD';
    const geo = isGeo && v.text ? geoName.get(v.text) : null;
    // A geo value that no longer resolves (deleted/stale district or neighborhood) must NOT
    // fall through to formatDetailValue, which would print the raw id — drop the row instead.
    if (isGeo && !geo) continue;
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
    canonicalPath: listingHref({ id: l.id, adNumber: l.adNumber ?? null, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null }),
    adNumber: l.adNumber ?? null,
    title: l.title,
    description: l.description,
    actualArea: l.area != null ? Number(l.area) : null,
    price: l.price != null && Number(l.price) > 0 ? Number(l.price) : null, // 0/blank ⇒ «السعر عند الطلب»
    priceUnit: l.priceUnit,
    priceNegotiable: l.priceNegotiable,
    soldPrice: l.soldPrice != null && Number(l.soldPrice) > 0 ? Number(l.soldPrice) : null, // 0 ⇒ «تم البيع» without a figure
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
    select: { values: { select: { number: true, attribute: { select: { key: true } }, optionId: true, listItemId: true } } },
  });
  let area: number | null = null;
  let districtOptionId: string | null = null;
  let districtListItemId: string | null = null;
  for (const v of base?.values ?? []) {
    if (v.attribute.key === ATTR.area && v.number != null) area = Number(v.number);
    // District SELECT lives in the shared OptionList post-migration (listItemId); legacy rows
    // still carry optionId. Match on whichever the base listing has.
    if (v.attribute.key === ATTR.district) {
      if (v.listItemId) districtListItemId = v.listItemId;
      else if (v.optionId) districtOptionId = v.optionId;
    }
  }
  const and: Prisma.ListingWhereInput[] = [{ id: { not: listingId } }];
  if (districtListItemId) and.push({ values: { some: { attribute: { key: ATTR.district }, listItemId: districtListItemId } } });
  else if (districtOptionId) and.push({ values: { some: { attribute: { key: ATTR.district }, optionId: districtOptionId } } });
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
