import { prisma } from '@noc/db';
import { getStandardAreas } from '../../../lib/marketplace';
import { partnershipsEnabled } from '../../../lib/modules';

export type CatalogAttrType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'PHOTOS'
  | 'DOCUMENTS'
  | 'URL'
  | 'PHONE'
  | 'DATE_FULL'
  | 'MONEY'
  | 'MONEY_THOUSANDS'
  | 'AREA_ORIGINAL'
  | 'AREA_ALLOCATED'
  | 'YESNO'
  | 'DISTRICT'
  | 'NEIGHBORHOOD';

export type AttrConfig = {
  yesLabelAr?: string;
  yesLabelEn?: string;
  noLabelAr?: string;
  noLabelEn?: string;
  multiple?: boolean;
};

/** Loads the active catalog shaped for the listing form (types grouped by category, sections, attributes). */
export async function loadCatalog() {
  const [classifiers, sections, attrs, standardAreas, conditionRows, districts, neighborhoods] = await Promise.all([
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true, allowedOnAlsawarey: true, parentLinks: { select: { parentId: true } } } } },
    }),
    prisma.attributeSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, nameAr: true, nameEn: true, order: true },
    }),
    prisma.attribute.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { id: true, labelAr: true, labelEn: true },
        },
        optionList: {
          select: { items: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } } },
        },
        classifierLinks: { select: { optionId: true } },
      },
    }),
    getStandardAreas(),
    prisma.buildingCondition.findMany({ where: { published: true }, orderBy: { order: 'asc' }, select: { id: true, unitLabelAr: true, unitLabelEn: true } }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, districtId: true, nameAr: true, nameEn: true } }),
  ]);

  // Geo-linked types are populated from the geographic DB (value stored = the geo row id).
  const districtOpts = districts.map((d) => ({ id: d.id, labelAr: d.nameAr, labelEn: d.nameEn }));
  const neighborhoodOpts = neighborhoods.map((n) => ({ id: n.id, labelAr: n.nameAr, labelEn: n.nameEn, districtId: n.districtId }));

  const attributes = attrs.map((a) => ({
    id: a.id,
    sectionId: a.sectionId,
    labelAr: a.labelAr,
    labelEn: a.labelEn,
    type: a.type as CatalogAttrType,
    unit: a.unit,
    config: (a.config as AttrConfig | null) ?? {},
    order: a.order,
    // SELECT/MULTI_SELECT choices come from the linked shared list; fall back to legacy inline
    // options. DISTRICT/NEIGHBORHOOD choices come straight from the geo DB.
    options:
      a.type === 'DISTRICT'
        ? districtOpts
        : a.type === 'NEIGHBORHOOD'
          ? neighborhoodOpts
          : a.optionListId && a.optionList
            ? a.optionList.items
            : a.options,
    optionIds: a.classifierLinks.map((l) => l.optionId),
  }));

  return {
    classifiers: classifiers.map((c) => ({
      id: c.id,
      key: c.key,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      options: c.options.map((o) => ({
        id: o.id,
        nameAr: o.nameAr,
        nameEn: o.nameEn,
        allowedOnAlsawarey: o.allowedOnAlsawarey,
        parentIds: o.parentLinks.map((l) => l.parentId),
      })),
    })),
    sections,
    attributes,
    standardAreas,
    buildingConditions: conditionRows,
    partnershipsOn: await partnershipsEnabled(),
  };
}

/** The two official-paper photos (internal) for a listing, keyed by stampCategory. */
export async function loadListingPapers(listingId: string) {
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPaper', ownerId: listingId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, path: true, originalName: true, stampCategory: true },
  });
  const pick = (cat: string) => {
    const r = rows.find((x) => x.stampCategory === cat);
    return r ? { id: r.id, path: r.path, originalName: r.originalName } : null;
  };
  return { allocation: pick('allocation_letter'), mandate: pick('sale_mandate') };
}

/** Splits a listing's attachments into the main gallery (no attribute) and per-property files. */
export async function loadListingAttachments(listingId: string) {
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'Listing', ownerId: listingId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, path: true, originalName: true, attributeId: true },
  });
  const photos = rows
    .filter((r) => !r.attributeId)
    .map((r) => ({ id: r.id, path: r.path, originalName: r.originalName }));
  const attachs: Record<string, { id: string; path: string; originalName: string }[]> = {};
  for (const r of rows) {
    if (!r.attributeId) continue;
    (attachs[r.attributeId] ??= []).push({ id: r.id, path: r.path, originalName: r.originalName });
  }
  return { photos, attachs };
}

type RawValue = {
  attributeId: string;
  text: string | null;
  number: unknown;
  bool: boolean | null;
  optionId: string | null;
  listItemId: string | null;
};

/** Rebuilds the form value map from stored ListingValue rows, keyed by attribute type.
 *  PHOTOS/DOCUMENTS are handled separately (see loadListingAttachments), so they're skipped here. */
export function buildVals(values: RawValue[], attrType: Map<string, string>) {
  const vals: Record<string, string | boolean | string[]> = {};
  for (const v of values) {
    const tp = attrType.get(v.attributeId);
    if (!tp || tp === 'PHOTOS' || tp === 'DOCUMENTS') continue;
    if (tp === 'MULTI_SELECT') {
      const cur = Array.isArray(vals[v.attributeId]) ? (vals[v.attributeId] as string[]) : [];
      const choice = v.listItemId ?? v.optionId;
      if (choice) vals[v.attributeId] = [...cur, choice];
    } else if (tp === 'SELECT') {
      const choice = v.listItemId ?? v.optionId;
      if (choice) vals[v.attributeId] = choice;
    } else if (tp === 'BOOLEAN' || tp === 'YESNO') {
      vals[v.attributeId] = v.bool ?? false;
    } else if (tp === 'NUMBER' || tp === 'MONEY' || tp === 'MONEY_THOUSANDS' || tp === 'AREA_ORIGINAL' || tp === 'AREA_ALLOCATED') {
      vals[v.attributeId] = v.number != null ? String(v.number) : '';
    } else {
      // TEXT / TEXTAREA / URL / PHONE / DATE (YYYY-MM) / DATE_FULL (YYYY-MM-DD)
      vals[v.attributeId] = v.text ?? '';
    }
  }
  return vals;
}
