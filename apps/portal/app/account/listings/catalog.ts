import { prisma } from '@noc/db';
import { getStandardAreas } from '../../../lib/marketplace';

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
  | 'YESNO';

export type AttrConfig = {
  yesLabelAr?: string;
  yesLabelEn?: string;
  noLabelAr?: string;
  noLabelEn?: string;
  multiple?: boolean;
};

/** Loads the active catalog shaped for the listing form (types grouped by category, sections, attributes). */
export async function loadCatalog() {
  const [classifiers, sections, attrs, standardAreas] = await Promise.all([
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
        classifierLinks: { select: { optionId: true } },
      },
    }),
    getStandardAreas(),
  ]);

  const attributes = attrs.map((a) => ({
    id: a.id,
    sectionId: a.sectionId,
    labelAr: a.labelAr,
    labelEn: a.labelEn,
    type: a.type as CatalogAttrType,
    unit: a.unit,
    config: (a.config as AttrConfig | null) ?? {},
    order: a.order,
    options: a.options,
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
  };
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
      if (v.optionId) vals[v.attributeId] = [...cur, v.optionId];
    } else if (tp === 'SELECT') {
      if (v.optionId) vals[v.attributeId] = v.optionId;
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
