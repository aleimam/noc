import { prisma } from '@noc/db';

// Server-only catalog + listing loaders for the lean partner form. Imported by server components
// (route pages) via '@noc/partner-portal/server' — never a client component.

export type LeanOption = { id: string; labelAr: string; labelEn: string; districtId?: string };
export type LeanAttr = {
  id: string;
  sectionId: string;
  labelAr: string;
  labelEn: string;
  type: string;
  unit: string | null;
  options: LeanOption[];
  usesList: boolean; // true → choices are shared OptionListItem ids; false → legacy AttributeOption ids
  optionIds: string[]; // classifier option ids this attribute is curated for
};

/** Catalog for the lean partner form. Type options are flagged `granted` per the owner's
 *  allowed categories; Purpose + Condition are always granted. Attributes carry their classifier
 *  links + choice options (shared list, legacy inline, or the geo DB for DISTRICT/NEIGHBORHOOD). */
export async function loadPartnerCatalog(ownerId: string) {
  const [classifiers, sections, attrs, grants, districts, neighborhoods] = await Promise.all([
    prisma.classifier.findMany({
      orderBy: { order: 'asc' },
      include: { options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, key: true, nameAr: true, nameEn: true } } },
    }),
    prisma.attributeSection.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.attribute.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        options: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } },
        optionList: { select: { items: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, labelAr: true, labelEn: true } } } },
        classifierLinks: { select: { optionId: true } },
      },
    }),
    prisma.ownerAllowedCategory.findMany({ where: { ownerId }, select: { optionId: true } }),
    prisma.district.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, districtId: true, nameAr: true, nameEn: true } }),
  ]);

  const grantedTypeIds = new Set(grants.map((g) => g.optionId));
  const districtOpts: LeanOption[] = districts.map((d) => ({ id: d.id, labelAr: d.nameAr, labelEn: d.nameEn }));
  const neighborhoodOpts: LeanOption[] = neighborhoods.map((n) => ({ id: n.id, labelAr: n.nameAr, labelEn: n.nameEn, districtId: n.districtId }));

  const attributes: LeanAttr[] = attrs.map((a) => ({
    id: a.id,
    sectionId: a.sectionId,
    labelAr: a.labelAr,
    labelEn: a.labelEn,
    type: a.type,
    unit: a.unit,
    options: a.type === 'DISTRICT' ? districtOpts : a.type === 'NEIGHBORHOOD' ? neighborhoodOpts : a.optionListId && a.optionList ? a.optionList.items : a.options,
    usesList: !!a.optionListId,
    optionIds: a.classifierLinks.map((l) => l.optionId),
  }));

  return {
    classifiers: classifiers.map((c) => ({
      id: c.id,
      key: c.key,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      options: c.options.map((o) => ({ id: o.id, nameAr: o.nameAr, nameEn: o.nameEn, granted: c.key !== 'type' || grantedTypeIds.has(o.id) })),
    })),
    sections,
    attributes,
  };
}

const NUM_TYPES = new Set(['NUMBER', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED']);

type RawValue = { attributeId: string; text: string | null; number: unknown; bool: boolean | null; optionId: string | null; listItemId: string | null };

/** Rebuild the lean form's value map from stored ListingValue rows, keyed by attribute type. */
function buildVals(values: RawValue[], attrType: Map<string, string>): Record<string, string | boolean | string[]> {
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
    } else if (NUM_TYPES.has(tp)) {
      vals[v.attributeId] = v.number != null ? String(Number(v.number)) : '';
    } else {
      vals[v.attributeId] = v.text ?? '';
    }
  }
  return vals;
}

/** Load a partner's own listing for editing (ownership-checked via ownerId): the base fields, its
 *  value map (ready for the form), and its gallery photos. Returns null if not theirs. */
export async function loadPartnerListing(listingId: string, ownerId: string) {
  const l = await prisma.listing.findFirst({
    where: { id: listingId, ownerId },
    select: {
      id: true, typeOptionId: true, purposeOptionId: true, conditionOptionId: true, title: true, description: true,
      price: true, priceUnit: true, contactPhone: true, contactWhatsapp: true, status: true,
      values: { select: { attributeId: true, text: true, number: true, bool: true, optionId: true, listItemId: true } },
    },
  });
  if (!l) return null;
  const [attrs, photos] = await Promise.all([
    prisma.attribute.findMany({ where: { id: { in: l.values.map((v) => v.attributeId) } }, select: { id: true, type: true } }),
    prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: listingId, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, path: true, originalName: true } }),
  ]);
  const attrType = new Map(attrs.map((a) => [a.id, a.type]));
  return {
    id: l.id,
    typeOptionId: l.typeOptionId,
    purposeOptionId: l.purposeOptionId,
    conditionOptionId: l.conditionOptionId,
    title: l.title,
    description: (l.description ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    price: l.price != null ? Number(l.price) : null,
    priceUnit: l.priceUnit,
    contactPhone: l.contactPhone,
    contactWhatsapp: l.contactWhatsapp,
    vals: buildVals(l.values, attrType),
    photos,
  };
}
