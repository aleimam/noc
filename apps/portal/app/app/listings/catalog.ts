import { prisma } from '@noc/db';

export type CatalogAttrType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'PHOTOS'
  | 'DOCUMENTS';

/** Loads the active catalog shaped for the listing form (types grouped by category, sections, attributes). */
export async function loadCatalog() {
  const [ptRaw, sections, attrs] = await Promise.all([
    prisma.propertyType.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        order: true,
        group: { select: { order: true, category: { select: { nameAr: true, nameEn: true, order: true } } } },
      },
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
        typeLinks: { select: { propertyTypeId: true } },
      },
    }),
  ]);

  const propertyTypes = ptRaw
    .map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      order: p.order,
      catAr: p.group?.category.nameAr ?? '',
      catEn: p.group?.category.nameEn ?? '',
      catOrder: p.group?.category.order ?? 999,
      grpOrder: p.group?.order ?? 999,
    }))
    .sort((a, b) => a.catOrder - b.catOrder || a.grpOrder - b.grpOrder || a.order - b.order);

  const attributes = attrs.map((a) => ({
    id: a.id,
    sectionId: a.sectionId,
    labelAr: a.labelAr,
    labelEn: a.labelEn,
    type: a.type as CatalogAttrType,
    unit: a.unit,
    order: a.order,
    options: a.options,
    typeIds: a.typeLinks.map((l) => l.propertyTypeId),
  }));

  return { propertyTypes, sections, attributes };
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
    } else if (tp === 'BOOLEAN') {
      vals[v.attributeId] = v.bool ?? false;
    } else if (tp === 'NUMBER') {
      vals[v.attributeId] = v.number != null ? String(v.number) : '';
    } else {
      // TEXT / TEXTAREA / DATE (stored as "YYYY-MM")
      vals[v.attributeId] = v.text ?? '';
    }
  }
  return vals;
}
