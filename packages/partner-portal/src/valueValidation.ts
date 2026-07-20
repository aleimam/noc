import { prisma } from '@noc/db';

/**
 * Server-side normalization of EAV listing values and of the classifier trio.
 *
 * Both save actions previously verified only attribute APPLICABILITY: they never checked that a
 * value used the column its attribute type requires, that an option id actually belongs to that
 * attribute, or that the three classifier ids belong to their own classifiers. A tampered payload
 * could therefore store `{ attributeId: <city SELECT>, bool: false }` — which satisfied the
 * required-details check (a boolean counts as answered) while the public renderer had no city to
 * show — or borrow a list item from an unrelated option list.
 *
 * Everything here NORMALIZES rather than rejects: unusable values are dropped, so a partly-bogus
 * payload cannot fail a whole save. The required-details check then runs on the NORMALIZED values,
 * so a dropped value correctly reads as "not answered".
 */

export type IncomingValue = {
  attributeId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[]; // legacy inline AttributeOption ids
  listItemIds?: string[]; // shared OptionListItem ids
  attachmentIds?: string[]; // PHOTOS / DOCUMENTS
};

// Which column each attribute type is allowed to write. Mirrors buildValues() in the two client
// forms — keep in step if a new attribute type is added.
const NUMERIC = new Set(['NUMBER', 'MONEY', 'MONEY_THOUSANDS', 'AREA_ORIGINAL', 'AREA_ALLOCATED']);
const BOOLEANY = new Set(['BOOLEAN', 'YESNO']);
const CHOICE = new Set(['SELECT', 'MULTI_SELECT']);
const TEXTUAL = new Set(['TEXT', 'TEXTAREA', 'URL', 'PHONE', 'DATE', 'DATE_FULL', 'DISTRICT', 'NEIGHBORHOOD']);
const FILE = new Set(['PHOTOS', 'DOCUMENTS']);

/** Drop/repair every value that does not fit its attribute's type or option universe. */
export async function normalizeListingValues(values: IncomingValue[]): Promise<IncomingValue[]> {
  const ids = [...new Set(values.map((v) => v.attributeId))];
  if (!ids.length) return [];
  const attrs = await prisma.attribute.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      type: true,
      optionList: { select: { items: { select: { id: true } } } },
      options: { select: { id: true } },
    },
  });
  const byId = new Map(attrs.map((a) => [a.id, a]));

  const out: IncomingValue[] = [];
  for (const v of values) {
    const a = byId.get(v.attributeId);
    if (!a) continue; // unknown attribute id → drop
    const t = a.type;

    if (FILE.has(t)) {
      // Attachment ownership is enforced separately (uploaderId) in each save.
      out.push({ attributeId: a.id, attachmentIds: v.attachmentIds ?? [] });
      continue;
    }

    if (CHOICE.has(t)) {
      const okItems = new Set((a.optionList?.items ?? []).map((i) => i.id));
      const okOpts = new Set(a.options.map((o) => o.id));
      // Classify each id by OWNERSHIP, not by the field the client happened to use: the portal
      // form always sends SELECT choices as `listItemIds`, even for an attribute with no shared
      // list — which would otherwise violate the listItemId foreign key and fail the save.
      // Ids belonging to neither set are cross-list/cross-attribute and are dropped.
      const incoming = [...new Set([...(v.listItemIds ?? []), ...(v.optionIds ?? [])])];
      let listItemIds = incoming.filter((id) => okItems.has(id));
      let optionIds = incoming.filter((id) => !okItems.has(id) && okOpts.has(id));
      if (t === 'SELECT') {
        // Single-choice: keep at most one, preferring the shared list.
        listItemIds = listItemIds.slice(0, 1);
        optionIds = listItemIds.length ? [] : optionIds.slice(0, 1);
      }
      if (!listItemIds.length && !optionIds.length) continue;
      out.push({ attributeId: a.id, listItemIds, optionIds });
      continue;
    }

    if (NUMERIC.has(t)) {
      if (v.number == null || !Number.isFinite(v.number)) continue;
      out.push({ attributeId: a.id, number: v.number });
      continue;
    }

    if (BOOLEANY.has(t)) {
      if (typeof v.bool !== 'boolean') continue;
      out.push({ attributeId: a.id, bool: v.bool });
      continue;
    }

    if (TEXTUAL.has(t)) {
      // DISTRICT/NEIGHBORHOOD store the geo row id in `text`; both saves resolve it afterwards.
      const s = typeof v.text === 'string' ? v.text.trim() : '';
      if (!s) continue;
      out.push({ attributeId: a.id, text: s });
      continue;
    }

    // Unknown / newly added type → drop rather than guess at a column.
  }
  return out;
}

export type ClassifierCheck = { ok: true } | { ok: false; error: 'bad_classifier' };

/** Each id must belong to its OWN classifier, be active, and respect Type → Purpose → Condition
 *  nesting. An option with no parent links is deliberately unscoped (applies to every parent). */
export async function validateClassifierTrio(
  typeOptionId: string,
  purposeOptionId: string,
  conditionOptionId: string,
): Promise<ClassifierCheck> {
  const opts = await prisma.classifierOption.findMany({
    where: { id: { in: [typeOptionId, purposeOptionId, conditionOptionId] } },
    select: {
      id: true,
      isActive: true,
      classifier: { select: { key: true } },
      parentLinks: { select: { parentId: true } },
    },
  });
  const byId = new Map(opts.map((o) => [o.id, o]));
  const type = byId.get(typeOptionId);
  const purpose = byId.get(purposeOptionId);
  const condition = byId.get(conditionOptionId);
  if (!type || !purpose || !condition) return { ok: false, error: 'bad_classifier' };
  if (type.classifier.key !== 'type' || purpose.classifier.key !== 'purpose' || condition.classifier.key !== 'condition') {
    return { ok: false, error: 'bad_classifier' };
  }
  if (!type.isActive || !purpose.isActive || !condition.isActive) return { ok: false, error: 'bad_classifier' };
  if (purpose.parentLinks.length && !purpose.parentLinks.some((l) => l.parentId === type.id)) {
    return { ok: false, error: 'bad_classifier' };
  }
  if (condition.parentLinks.length && !condition.parentLinks.some((l) => l.parentId === purpose.id)) {
    return { ok: false, error: 'bad_classifier' };
  }
  return { ok: true };
}
