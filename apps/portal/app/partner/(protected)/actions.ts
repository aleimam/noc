'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePartner } from '@noc/auth';

type Result = { ok: true } | { ok: false; error: string };

// Fast edits are instant (owner decision: structural changes need approval, price and
// availability do not). Partners may only touch these statuses — never the moderation
// ones (DRAFT/PENDING/REJECTED stay staff-controlled).
const FAST_STATUSES = ['PUBLISHED', 'SOLD', 'ARCHIVED'] as const;
type FastStatus = (typeof FAST_STATUSES)[number];

/** Load a listing only if it belongs to the signed-in partner's Owner. */
async function ownListing(listingId: string, ownerId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, ownerId: true, status: true } });
  return l && l.ownerId === ownerId ? l : null;
}

/** Instant price update on the partner's own listing. */
export async function partnerUpdatePrice(listingId: string, price: number | null): Promise<Result> {
  const { ownerId } = await requirePartner();
  if (price != null && (!Number.isFinite(price) || price < 0)) return { ok: false, error: 'invalid' };
  const l = await ownListing(listingId, ownerId);
  if (!l) return { ok: false, error: 'forbidden' };
  await prisma.listing.update({
    where: { id: listingId },
    data: { price, postersStale: true }, // price shows on the generated images
  });
  revalidatePath('/partner');
  return { ok: true };
}

/** Instant availability change (متاح / تم البيع / إخفاء) on the partner's own listing. */
export async function partnerSetAvailability(listingId: string, status: FastStatus, soldPrice?: number | null): Promise<Result> {
  const { ownerId } = await requirePartner();
  if (!FAST_STATUSES.includes(status)) return { ok: false, error: 'invalid' };
  const l = await ownListing(listingId, ownerId);
  if (!l) return { ok: false, error: 'forbidden' };
  // Only listings already in the public lifecycle may be fast-switched.
  if (!FAST_STATUSES.includes(l.status as FastStatus)) return { ok: false, error: 'not_editable' };
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status,
      soldPrice: status === 'SOLD' ? (soldPrice != null && Number.isFinite(soldPrice) && soldPrice >= 0 ? soldPrice : null) : null,
    },
  });
  revalidatePath('/partner');
  return { ok: true };
}
