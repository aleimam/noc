// Storefront land queries. Owner identity is NEVER selected here — visitors see every
// land as "ours" (alsawarey decision #17). Management lives in the New Obour backend.
import { prisma, Prisma } from '@noc/db';

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
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null },
    orderBy: { createdAt: 'asc' },
    select: { ownerId: true, path: true },
  });
  for (const r of rows) if (r.ownerId && !cover.has(r.ownerId)) cover.set(r.ownerId, r.path);
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
  };
}

// Listings visible on the storefront: published (available) or sold — both shown publicly.
const STOREFRONT_STATUS: Prisma.ListingWhereInput = {
  showOnBrokerage: true,
  status: { in: ['PUBLISHED', 'SOLD'] },
};

/** The set of listing IDs the given user has wishlisted (empty when not signed in). */
export async function wishlistIds(userId?: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.wishlist.findMany({ where: { userId }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}

export async function latestLands(take = 6): Promise<LandCard[]> {
  const rows = await prisma.listing.findMany({
    where: STOREFRONT_STATUS,
    orderBy: [{ status: 'asc' }, { publishedAt: 'desc' }],
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
  price: number | null;
  soldPrice: number | null;
  priceNote: string | null;
  status: string;
  typeAr: string | null;
  gallery: string[];
  specs: { label: string; value: string }[]; // public attributes, localized
};

export async function getLandDetail(id: string, locale: 'ar' | 'en'): Promise<LandDetail | null> {
  const l = await prisma.listing.findFirst({
    where: { id, ...STOREFRONT_STATUS },
    select: {
      id: true,
      adNumber: true,
      title: true,
      description: true,
      price: true,
      soldPrice: true,
      priceNote: true,
      status: true,
      typeOption: { select: { nameAr: true, nameEn: true } },
      values: {
        select: {
          number: true,
          bool: true,
          text: true,
          attribute: { select: { key: true, labelAr: true, labelEn: true, unit: true, order: true, isActive: true } },
          option: { select: { labelAr: true, labelEn: true } },
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

  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const specs: { label: string; value: string }[] = [];
  for (const v of l.values) {
    if (!v.attribute.isActive) continue;
    const label = L(v.attribute.labelAr, v.attribute.labelEn);
    let value: string | null = null;
    if (v.option) value = L(v.option.labelAr, v.option.labelEn);
    else if (v.number != null) value = `${Number(v.number).toLocaleString('en')}${v.attribute.unit ? ' ' + v.attribute.unit : ''}`;
    else if (v.bool != null) value = v.bool ? L('نعم', 'Yes') : L('لا', 'No');
    else if (v.text) value = v.text;
    if (value) specs.push({ label, value });
  }

  return {
    id: l.id,
    adNumber: l.adNumber ?? null,
    title: l.title,
    description: l.description,
    price: l.price != null ? Number(l.price) : null,
    soldPrice: l.soldPrice != null ? Number(l.soldPrice) : null,
    priceNote: l.priceNote,
    status: l.status,
    typeAr: locale === 'ar' ? l.typeOption?.nameAr ?? null : l.typeOption?.nameEn ?? null,
    gallery,
    specs,
  };
}

export async function listLands(
  opts: { where?: Prisma.ListingWhereInput; orderBy?: Prisma.ListingOrderByWithRelationInput[]; take?: number; skip?: number } = {},
): Promise<{ cards: LandCard[]; total: number }> {
  const where: Prisma.ListingWhereInput = { AND: [STOREFRONT_STATUS, opts.where ?? {}] };
  const orderBy = opts.orderBy ?? [{ status: 'asc' }, { publishedAt: 'desc' }];
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, take: opts.take ?? 24, skip: opts.skip ?? 0, select: cardSelect }),
    prisma.listing.count({ where }),
  ]);
  const cover = await coversFor(rows.map((r) => r.id));
  return { cards: rows.map((r) => toCard(r, cover)), total };
}
