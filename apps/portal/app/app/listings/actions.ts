'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { auth } from '@noc/auth';

export type ValueInput = {
  attributeId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[];
};

export type ListingInput = {
  id?: string;
  propertyTypeId: string;
  title: string;
  description?: string;
  price?: number | null;
  priceNote?: string;
  contactPhone: string;
  contactWhatsapp: boolean;
  ownerId?: string | null;
  ownerName?: string;
  ownerType?: 'OWNER' | 'COMPANY' | 'BROKER' | 'US';
  showOnBrokerage?: boolean;
  values: ValueInput[];
  photoIds: string[];
  status: 'DRAFT' | 'PENDING';
};

type Result = { ok: true; id: string } | { ok: false; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeValues(tx: any, listingId: string, values: ValueInput[]) {
  await tx.listingValue.deleteMany({ where: { listingId } });
  const rows: Array<Record<string, unknown>> = [];
  for (const v of values) {
    if (v.optionIds && v.optionIds.length) {
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
  if (!input.propertyTypeId || !input.title.trim() || !input.contactPhone.trim()) {
    return { ok: false, error: 'failed' };
  }
  const isStaff = user.type === 'STAFF';

  try {
    const id = await prisma.$transaction(async (tx) => {
      const base = {
        propertyTypeId: input.propertyTypeId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        price: input.price ?? null,
        priceNote: input.priceNote?.trim() || null,
        contactPhone: input.contactPhone.trim(),
        contactWhatsapp: input.contactWhatsapp,
        status: input.status,
        // Channel + owner: staff manage our inventory (link to Owner, brokerage toggle);
        // sellers define the owner inline and never publish to the brokerage.
        showOnBrokerage: isStaff ? !!input.showOnBrokerage : false,
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
          data: { ...base, rejectionReason: null },
        });
        listingId = input.id;
      } else {
        const created = await tx.listing.create({
          data: { ...base, sellerId: user.id, createdById: isStaff ? user.id : null },
        });
        listingId = created.id;
      }

      await writeValues(tx, listingId, input.values);

      // Claim newly-attached photos uploaded by this user.
      if (input.photoIds.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.photoIds }, uploaderId: user.id },
          data: { ownerType: 'Listing', ownerId: listingId },
        });
      }
      // Release photos that were on this listing but are no longer selected.
      await tx.attachment.updateMany({
        where: {
          ownerType: 'Listing',
          ownerId: listingId,
          ...(input.photoIds.length ? { id: { notIn: input.photoIds } } : {}),
        },
        data: { ownerType: null, ownerId: null },
      });

      return listingId;
    });

    revalidatePath('/app/listings');
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
  revalidatePath('/app/listings');
  return { ok: true, id };
}
