'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePartner, hashPassword, rateLimit } from '@noc/auth';
import { isValidPhone } from '@noc/config';

type Result = { ok: true } | { ok: false; error: string };

/** Partner self-service: update own login identifiers + password (owner decision). */
export async function partnerUpdateAccount(input: { username: string; email: string; phone: string; password: string }): Promise<Result> {
  const { userId } = await requirePartner();
  if (!rateLimit(`pacct:${userId}`, 5, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const username = input.username.trim().toLowerCase() || null;
  const email = input.email.trim().toLowerCase() || null;
  const phone = input.phone.trim() || null;
  if (!username && !email && !phone) return { ok: false, error: 'identifier_required' };
  if (phone && !isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };
  try {
    const passPatch = input.password.trim() ? { passwordHash: await hashPassword(input.password.trim()) } : {};
    await prisma.user.update({ where: { id: userId }, data: { username, email, phone, ...passPatch } });
    revalidatePath('/partner/account');
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes('Unique constraint') || msg.includes('P2002') ? 'duplicate_key' : 'failed' };
  }
}

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
  const { ownerId, userId } = await requirePartner();
  if (!rateLimit(`pfast:${userId}`, 30, 60 * 1000)) return { ok: false, error: 'rate_limited' };
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
  const { ownerId, userId } = await requirePartner();
  if (!rateLimit(`pfast:${userId}`, 30, 60 * 1000)) return { ok: false, error: 'rate_limited' };
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
