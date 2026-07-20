import { prisma } from '@noc/db';
import { REQUIRED_LISTING_ATTR_KEYS } from '@noc/config';

/**
 * ONE source of truth for "does this listing have every required detail filled?".
 *
 * Required details are admin-configurable (`Attribute.required`, 2026-07-19), and the check used
 * to live inline in the two form-save actions ONLY. That left three ways to publish an incomplete
 * listing: an admin approving a row that entered the queue before a rule changed, an ARCHIVED
 * listing being reactivated, and a forged PENDING status change. Every transition to
 * PENDING/PUBLISHED now runs through here.
 *
 * Invariants (keep in step with the two client forms — see CLAUDE.md):
 *  - only attributes APPLICABLE to the chosen Type/Purpose/Condition are demanded;
 *  - a boolean `false` («لا» on a YESNO) COUNTS as answered;
 *  - PHOTOS/DOCUMENTS can never be required — their data rides Attachment rows this
 *    values-based check cannot see, so requiring one would block publishing forever.
 */

export type RequiredCheckValue = {
  attributeId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[]; // legacy inline AttributeOption ids
  listItemIds?: string[]; // shared OptionListItem ids
};

export type MissingRequiredAttribute = { id: string; key: string; labelAr: string; labelEn: string };

/** Required attributes that actually APPLY to the chosen classifier trio. */
async function applicableRequired(chosenOptionIds: string[]): Promise<MissingRequiredAttribute[]> {
  const required = await prisma.attribute.findMany({
    // The DB flag is the source of truth; the city key remains a defensive fallback.
    where: {
      isActive: true,
      type: { notIn: ['PHOTOS', 'DOCUMENTS'] },
      OR: [{ required: true }, { key: { in: [...REQUIRED_LISTING_ATTR_KEYS] } }],
    },
    select: {
      id: true,
      key: true,
      labelAr: true,
      labelEn: true,
      classifierLinks: { select: { optionId: true, option: { select: { classifierId: true } } } },
    },
  });
  const chosen = new Set(chosenOptionIds.filter(Boolean));
  const out: MissingRequiredAttribute[] = [];
  for (const a of required) {
    if (a.classifierLinks.length === 0) continue; // not curated → hidden everywhere → not applicable
    // An attribute applies only if EVERY classifier it is curated for has one of its options chosen.
    const byCls = new Map<string, string[]>();
    for (const l of a.classifierLinks) {
      const arr = byCls.get(l.option.classifierId) ?? [];
      arr.push(l.optionId);
      byCls.set(l.option.classifierId, arr);
    }
    let applicable = byCls.size > 0;
    for (const allowed of byCls.values()) {
      if (!allowed.some((oid) => chosen.has(oid))) { applicable = false; break; }
    }
    if (applicable) out.push({ id: a.id, key: a.key, labelAr: a.labelAr, labelEn: a.labelEn });
  }
  return out;
}

/** A boolean `false` is a real ANSWER — «لا» on a required YESNO must pass. */
function answered(v: RequiredCheckValue | undefined): boolean {
  if (!v) return false;
  return (
    (v.listItemIds?.length ?? 0) > 0 ||
    (v.optionIds?.length ?? 0) > 0 ||
    (typeof v.text === 'string' && v.text.trim() !== '') ||
    v.number != null ||
    typeof v.bool === 'boolean'
  );
}

/** Form-save path: validate the PAYLOAD before it is written. */
export async function missingRequiredForInput(
  chosenOptionIds: string[],
  values: RequiredCheckValue[],
): Promise<MissingRequiredAttribute[]> {
  const required = await applicableRequired(chosenOptionIds);
  if (!required.length) return [];
  return required.filter((a) => !answered(values.find((v) => v.attributeId === a.id)));
}

/** Moderation path: validate a STORED listing (approve / reactivate / status change).
 *  A missing listing returns [] — the caller's own update is what should fail in that case. */
export async function missingRequiredForListing(listingId: string): Promise<MissingRequiredAttribute[]> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      typeOptionId: true,
      purposeOptionId: true,
      conditionOptionId: true,
      values: { select: { attributeId: true, text: true, number: true, bool: true, optionId: true, listItemId: true } },
    },
  });
  if (!listing) return [];
  const required = await applicableRequired([
    listing.typeOptionId ?? '',
    listing.purposeOptionId ?? '',
    listing.conditionOptionId ?? '',
  ]);
  if (!required.length) return [];
  // Stored values are one row per value; collapse them into the payload shape the check expects.
  const byAttr = new Map<string, RequiredCheckValue>();
  for (const v of listing.values) {
    const cur = byAttr.get(v.attributeId) ?? { attributeId: v.attributeId };
    if (v.listItemId) (cur.listItemIds ??= []).push(v.listItemId);
    if (v.optionId) (cur.optionIds ??= []).push(v.optionId);
    if (v.text != null && v.text !== '') cur.text = v.text;
    if (v.number != null) cur.number = Number(v.number);
    if (v.bool != null) cur.bool = v.bool;
    byAttr.set(v.attributeId, cur);
  }
  return required.filter((a) => !answered(byAttr.get(a.id)));
}

/** Localized labels for an error message / toast. */
export function missingLabels(missing: MissingRequiredAttribute[], locale: 'ar' | 'en'): string[] {
  return missing.map((m) => (locale === 'ar' ? m.labelAr : m.labelEn));
}
