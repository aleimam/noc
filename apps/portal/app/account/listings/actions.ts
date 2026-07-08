'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { auth } from '@noc/auth';
import { isValidPhone } from '@noc/config';

import { sanitizeRichHtml } from '../../../lib/sanitize';

export type ValueInput = {
  attributeId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[]; // legacy inline AttributeOption ids
  listItemIds?: string[]; // shared OptionListItem ids (SELECT / MULTI_SELECT)
  attachmentIds?: string[]; // PHOTOS / DOCUMENTS — ids of files for this attribute
};

export type ListingInput = {
  id?: string;
  typeOptionId: string;
  purposeOptionId: string;
  conditionOptionId: string;
  title: string;
  description?: string;
  area?: number | null;
  price?: number | null;
  priceUnit?: 'TOTAL' | 'UNIT' | 'SQM';
  priceNegotiable?: boolean;
  priceNote?: string;
  isPartnership?: boolean;
  partnershipType?: string | null; // PartnershipType key, validated server-side
  partnershipNote?: string;
  cardTitle?: string; // staff marketing headline for the generated cards
  contactPhone: string;
  contactWhatsapp: boolean;
  ownerId?: string | null;
  ownerName?: string;
  ownerType?: 'PERSONAL' | 'COMPANY' | 'BROKER' | 'US';
  showOnBrokerage?: boolean;
  values: ValueInput[];
  photoIds: string[];
  buildingConditionIds?: string[];
  status: 'DRAFT' | 'PENDING';
};

type Result = { ok: true; id: string } | { ok: false; error: string };

const PARTNERSHIP_TYPES = ['CONSOLIDATION', 'JOINT_BUILD', 'SHARE_SALE'] as const;
type PartnershipTypeKey = (typeof PARTNERSHIP_TYPES)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeValues(tx: any, listingId: string, values: ValueInput[]) {
  await tx.listingValue.deleteMany({ where: { listingId } });
  const rows: Array<Record<string, unknown>> = [];
  for (const v of values) {
    if (v.attachmentIds) {
      // PHOTOS / DOCUMENTS: marker row records the attribute (+ its file ids) so it shows in its section.
      if (v.attachmentIds.length) rows.push({ listingId, attributeId: v.attributeId, text: JSON.stringify(v.attachmentIds) });
      continue;
    }
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

export async function saveListing(input: ListingInput): Promise<Result> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!input.typeOptionId || !input.purposeOptionId || !input.conditionOptionId || !input.title.trim() || !input.contactPhone.trim()) {
    return { ok: false, error: 'failed' };
  }
  if (!isValidPhone(input.contactPhone)) return { ok: false, error: 'invalid_phone' };
  const isStaff = user.type === 'STAFF';

  // Al-Sawarey channel is staff-only and limited to allowed Types/Purposes (backstop; the
  // form already hides disallowed options).
  const publishAlsawarey = isStaff && !!input.showOnBrokerage;
  if (publishAlsawarey) {
    const opts = await prisma.classifierOption.findMany({
      where: { id: { in: [input.typeOptionId, input.purposeOptionId] } },
      select: { allowedOnAlsawarey: true },
    });
    if (opts.length < 2 || opts.some((o) => !o.allowedOnAlsawarey)) return { ok: false, error: 'alsawarey_not_allowed' };
  }

  // Applicability guard (server-side mirror of the form's rule): keep only values whose
  // attribute is explicitly linked to the chosen classifier options — unlinked attributes
  // are hidden from forms and must not be saved; this also drops stale values when an
  // edited listing's category changes.
  {
    const attrIds = [...new Set(input.values.map((v) => v.attributeId))];
    if (attrIds.length) {
      const attrs = await prisma.attribute.findMany({
        where: { id: { in: attrIds } },
        select: { id: true, classifierLinks: { select: { optionId: true, option: { select: { classifierId: true } } } } },
      });
      const chosen = new Set([input.typeOptionId, input.purposeOptionId, input.conditionOptionId]);
      const applicable = new Set<string>();
      for (const a of attrs) {
        if (a.classifierLinks.length === 0) continue; // not curated → hidden everywhere
        const byCls = new Map<string, string[]>();
        for (const l of a.classifierLinks) {
          const arr = byCls.get(l.option.classifierId) ?? [];
          arr.push(l.optionId);
          byCls.set(l.option.classifierId, arr);
        }
        let ok = byCls.size > 0;
        for (const allowed of byCls.values()) {
          if (!allowed.some((oid) => chosen.has(oid))) { ok = false; break; }
        }
        if (ok) applicable.add(a.id);
      }
      input = { ...input, values: input.values.filter((v) => applicable.has(v.attributeId)) };
    }
  }

  // Keep the structural geo link in sync with the NEIGHBORHOOD detail (powers the
  // district/neighborhood pages' listing sections + inherited maps/amenities).
  let neighborhoodId: string | null = null;
  {
    const attrIds = input.values.map((v) => v.attributeId);
    if (attrIds.length) {
      const nbAttrs = await prisma.attribute.findMany({
        where: { id: { in: attrIds }, type: 'NEIGHBORHOOD' },
        select: { id: true },
      });
      const nbAttrIds = new Set(nbAttrs.map((a) => a.id));
      const candidate = input.values.find((v) => nbAttrIds.has(v.attributeId) && typeof v.text === 'string' && v.text.trim());
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
        description: sanitizeRichHtml(input.description?.trim() || null) || null,
        area: input.area != null && !Number.isNaN(input.area) ? input.area : null,
        price: input.price ?? null,
        priceUnit: input.priceUnit ?? 'TOTAL',
        priceNegotiable: input.priceNegotiable ?? false,
        priceNote: input.priceNote?.trim() || null,
        // Partnership opt-in: type/note only persist while the flag is on.
        isPartnership: !!input.isPartnership,
        partnershipType:
          input.isPartnership && PARTNERSHIP_TYPES.includes(input.partnershipType as PartnershipTypeKey)
            ? (input.partnershipType as PartnershipTypeKey)
            : null,
        partnershipNote: input.isPartnership ? input.partnershipNote?.trim().slice(0, 190) || null : null,
        // Card Title is staff-managed; seller edits must not wipe it.
        ...(isStaff ? { cardTitle: input.cardTitle?.trim().slice(0, 120) || null } : {}),
        contactPhone: input.contactPhone.trim(),
        contactWhatsapp: input.contactWhatsapp,
        status: input.status,
        // Channel + owner: staff manage our inventory (link to Owner, brokerage toggle);
        // sellers define the owner inline and never publish to the brokerage.
        showOnBrokerage: publishAlsawarey,
        ownerId: isStaff ? input.ownerId || null : null,
        ownerName: !isStaff ? input.ownerName?.trim() || null : null,
        ownerType: !isStaff ? input.ownerType ?? null : null,
      };

      let listingId: string;
      if (input.id) {
        const existing = await tx.listing.findUnique({ where: { id: input.id } });
        if (!existing || (existing.sellerId !== user.id && !isStaff)) throw new Error('forbidden');
        await tx.listing.update({
          where: { id: input.id },
          data: { ...base, rejectionReason: null, postersStale: true }, // data changed → generated images out of date
        });
        listingId = input.id;
      } else {
        const created = await tx.listing.create({
          data: { ...base, sellerId: user.id, createdById: isStaff ? user.id : null },
        });
        listingId = created.id;
      }

      await writeValues(tx, listingId, input.values);

      // ── Main gallery photos (attributeId = null) ──
      if (input.photoIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.photoIds }, uploaderId: user.id },
          data: { ownerType: 'Listing', ownerId: listingId, attributeId: null },
        });
      }
      await tx.attachment.updateMany({
        where: {
          ownerType: 'Listing',
          ownerId: listingId,
          attributeId: null,
          ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}),
        },
        data: { ownerType: null, ownerId: null },
      });

      // ── Per-property PHOTOS/DOCUMENTS (attributeId = the attribute) ──
      const keepIds: string[] = [];
      for (const v of input.values) {
        if (!v.attachmentIds) continue;
        keepIds.push(...v.attachmentIds);
        if (v.attachmentIds.length) {
          await tx.attachment.updateMany({
            where: { id: { in: v.attachmentIds }, uploaderId: user.id },
            data: { ownerType: 'Listing', ownerId: listingId, attributeId: v.attributeId },
          });
        }
      }
      await tx.attachment.updateMany({
        where: {
          ownerType: 'Listing',
          ownerId: listingId,
          attributeId: { not: null },
          ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
        },
        data: { ownerType: null, ownerId: null, attributeId: null },
      });

      // ── Attached building-conditions pages (manual, optional) ──
      const condIds = [...new Set(input.buildingConditionIds ?? [])];
      await tx.listingBuildingCondition.deleteMany({ where: { listingId } });
      if (condIds.length) {
        await tx.listingBuildingCondition.createMany({
          data: condIds.map((conditionId) => ({ listingId, conditionId })),
          skipDuplicates: true,
        });
      }

      return listingId;
    });

    revalidatePath('/account/listings');
    revalidatePath('/admin/marketplace/listings', 'page');
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg === 'forbidden' ? 'forbidden' : 'failed' };
  }
}

export async function setMyListingStatus(
  id: string,
  status: 'SOLD' | 'ARCHIVED' | 'DRAFT' | 'PENDING',
): Promise<Result> {
  const session = await auth();
  const user = session?.user;
  if (!user) return { ok: false, error: 'unauthorized' };
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || (existing.sellerId !== user.id && user.type !== 'STAFF')) {
    return { ok: false, error: 'forbidden' };
  }
  await prisma.listing.update({ where: { id }, data: { status } });
  revalidatePath('/account/listings');
  return { ok: true, id };
}
