'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePartner } from '@noc/auth';
import { isValidPhone, REQUIRED_LISTING_ATTR_KEYS } from '@noc/config';

export type LeanValueInput = {
  attributeId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[]; // legacy inline AttributeOption ids
  listItemIds?: string[]; // shared OptionListItem ids (SELECT / MULTI_SELECT)
};

export type LeanListingInput = {
  id?: string;
  typeOptionId: string;
  purposeOptionId: string;
  conditionOptionId: string;
  title: string;
  description?: string;
  price?: number | null;
  priceUnit?: 'TOTAL' | 'UNIT' | 'SQM';
  contactPhone: string;
  contactWhatsapp: boolean;
  values: LeanValueInput[];
  photoIds: string[];
};

type Result = { ok: true; id: string } | { ok: false; error: string };

/** Escape HTML so a plain-text partner description is safe wherever descriptions render as HTML,
 *  preserving line breaks. (The full staff form stores sanitized rich HTML; the lean form is plain.) */
function toSafeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeValues(tx: any, listingId: string, values: LeanValueInput[]) {
  await tx.listingValue.deleteMany({ where: { listingId } });
  const rows: Array<Record<string, unknown>> = [];
  for (const v of values) {
    if (v.listItemIds && v.listItemIds.length) {
      for (const listItemId of v.listItemIds) rows.push({ listingId, attributeId: v.attributeId, listItemId });
    } else if (v.optionIds && v.optionIds.length) {
      for (const optionId of v.optionIds) rows.push({ listingId, attributeId: v.attributeId, optionId });
    } else if (typeof v.text === 'string' && v.text.trim() !== '') {
      rows.push({ listingId, attributeId: v.attributeId, text: v.text.trim() });
    } else if (v.number != null && !Number.isNaN(v.number)) {
      rows.push({ listingId, attributeId: v.attributeId, number: v.number });
    } else if (v.bool != null) {
      rows.push({ listingId, attributeId: v.attributeId, bool: v.bool });
    }
  }
  if (rows.length) await tx.listingValue.createMany({ data: rows });
}

/** Lean partner listing create/edit. Always the partner's own Owner, always moderated (PENDING);
 *  staff-only fields (papers, card title, brokerage) and inline stamping are left to staff review. */
export async function savePartnerListing(input: LeanListingInput): Promise<Result> {
  const { ownerId, userId } = await requirePartner();
  if (!input.typeOptionId || !input.purposeOptionId || !input.conditionOptionId || !input.title.trim() || !input.contactPhone.trim()) {
    return { ok: false, error: 'failed' };
  }
  if (!isValidPhone(input.contactPhone)) return { ok: false, error: 'invalid_phone' };

  // Partners may only post in the Type categories the admin granted their Owner.
  const grant = await prisma.ownerAllowedCategory.findFirst({ where: { ownerId, optionId: input.typeOptionId }, select: { id: true } });
  if (!grant) return { ok: false, error: 'category_not_allowed' };

  // Applicability guard (mirror of the staff save): keep only values whose attribute is curated
  // for one of the chosen classifier options; drops stale values when the category changes.
  let values = input.values;
  {
    const attrIds = [...new Set(values.map((v) => v.attributeId))];
    if (attrIds.length) {
      const attrs = await prisma.attribute.findMany({
        where: { id: { in: attrIds } },
        select: { id: true, classifierLinks: { select: { optionId: true, option: { select: { classifierId: true } } } } },
      });
      const chosen = new Set([input.typeOptionId, input.purposeOptionId, input.conditionOptionId]);
      const applicable = new Set<string>();
      for (const a of attrs) {
        if (a.classifierLinks.length === 0) continue;
        const byCls = new Map<string, string[]>();
        for (const l of a.classifierLinks) {
          const arr = byCls.get(l.option.classifierId) ?? [];
          arr.push(l.optionId);
          byCls.set(l.option.classifierId, arr);
        }
        let ok = byCls.size > 0;
        for (const allowed of byCls.values()) if (!allowed.some((oid) => chosen.has(oid))) { ok = false; break; }
        if (ok) applicable.add(a.id);
      }
      values = values.filter((v) => applicable.has(v.attributeId));
    }
  }

  // Mandatory basic details (e.g. the city): enforce server-side — partner submissions always
  // publish into moderation (PENDING), so the requirement always applies here.
  {
    const required = await prisma.attribute.findMany({
      // DB flag is the source of truth; the city key is a defensive fallback.
      where: { isActive: true, OR: [{ required: true }, { key: { in: [...REQUIRED_LISTING_ATTR_KEYS] } }] },
      select: { id: true, classifierLinks: { select: { optionId: true, option: { select: { classifierId: true } } } } },
    });
    const chosen = new Set([input.typeOptionId, input.purposeOptionId, input.conditionOptionId]);
    for (const a of required) {
      if (a.classifierLinks.length === 0) continue; // not curated → not applicable anywhere
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
      if (!applicable) continue;
      const v = values.find((x) => x.attributeId === a.id);
      const has =
        !!v &&
        ((v.listItemIds?.length ?? 0) > 0 ||
          (v.optionIds?.length ?? 0) > 0 ||
          (typeof v.text === 'string' && v.text.trim() !== '') ||
          v.number != null ||
          typeof v.bool === 'boolean');
      if (!has) return { ok: false, error: 'failed' };
    }
  }

  // Keep the structural geo link in sync with the NEIGHBORHOOD attribute value.
  let neighborhoodId: string | null = null;
  {
    const attrIds = values.map((v) => v.attributeId);
    if (attrIds.length) {
      const nbAttrs = await prisma.attribute.findMany({ where: { id: { in: attrIds }, type: 'NEIGHBORHOOD' }, select: { id: true } });
      const nbAttrIds = new Set(nbAttrs.map((a) => a.id));
      const candidate = values.find((v) => nbAttrIds.has(v.attributeId) && typeof v.text === 'string' && v.text.trim());
      if (candidate?.text) {
        const nb = await prisma.neighborhood.findUnique({ where: { id: candidate.text.trim() }, select: { id: true } });
        neighborhoodId = nb?.id ?? null;
      }
    }
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const base = {
        neighborhoodId,
        typeOptionId: input.typeOptionId,
        purposeOptionId: input.purposeOptionId,
        conditionOptionId: input.conditionOptionId,
        title: input.title.trim(),
        description: input.description?.trim() ? toSafeHtml(input.description.trim().slice(0, 5000)) : null,
        // Reject NaN/negative prices server-side (mirrors partnerUpdatePrice).
        price: input.price != null && Number.isFinite(input.price) && input.price >= 0 ? input.price : null,
        priceUnit: input.priceUnit ?? 'TOTAL',
        contactPhone: input.contactPhone.trim(),
        contactWhatsapp: input.contactWhatsapp,
        status: 'PENDING' as const, // partner writes are always moderated
        ownerId,
      };

      let listingId: string;
      if (input.id) {
        const existing = await tx.listing.findFirst({ where: { id: input.id, ownerId }, select: { id: true } });
        if (!existing) throw new Error('forbidden');
        await tx.listing.update({ where: { id: input.id }, data: { ...base, rejectionReason: null, postersStale: true } });
        listingId = input.id;
      } else {
        const created = await tx.listing.create({ data: { ...base, sellerId: userId } });
        listingId = created.id;
      }

      await writeValues(tx, listingId, values);

      // Main gallery photos (attributeId = null) — claim the chosen, release the rest.
      if (input.photoIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.photoIds }, uploaderId: userId },
          data: { ownerType: 'Listing', ownerId: listingId, attributeId: null },
        });
      }
      await tx.attachment.updateMany({
        where: { ownerType: 'Listing', ownerId: listingId, attributeId: null, ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}) },
        data: { ownerType: null, ownerId: null },
      });

      return listingId;
    });

    revalidatePath('/partner');
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === 'forbidden' ? 'forbidden' : 'failed' };
  }
}
