import { prisma } from '@noc/db';

/** Loads the active catalog shaped for the listing form (types, sections, attributes + options + type links). */
export async function loadCatalog() {
  const [propertyTypes, sections, attrs] = await Promise.all([
    prisma.propertyType.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, nameAr: true, nameEn: true },
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

  const attributes = attrs.map((a) => ({
    id: a.id,
    sectionId: a.sectionId,
    labelAr: a.labelAr,
    labelEn: a.labelEn,
    type: a.type as 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT',
    unit: a.unit,
    order: a.order,
    options: a.options,
    typeIds: a.typeLinks.map((l) => l.propertyTypeId),
  }));

  return { propertyTypes, sections, attributes };
}

type RawValue = {
  attributeId: string;
  text: string | null;
  number: unknown;
  bool: boolean | null;
  optionId: string | null;
};

/** Rebuilds the form value map from stored ListingValue rows, keyed by attribute type. */
export function buildVals(values: RawValue[], attrType: Map<string, string>) {
  const vals: Record<string, string | boolean | string[]> = {};
  for (const v of values) {
    const tp = attrType.get(v.attributeId);
    if (!tp) continue;
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
      vals[v.attributeId] = v.text ?? '';
    }
  }
  return vals;
}
