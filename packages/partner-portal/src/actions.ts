'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import {
  requirePartner, hashPassword, rateLimit, MIN_PASSWORD_LENGTH,
  currentSite, requestOtp, requestEmailOtp, verifyOtp, verifyEmailOtp, normalizePhone,
} from '@noc/auth';
import { isValidEmail, isValidPhone, parsePriceInput } from '@noc/config';

type Result = { ok: true } | { ok: false; error: string };

const otpBrand = () => (currentSite() === 'alsawarey' ? 'alsawarey' : 'newobour');
const dupOrFail = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false as const, error: msg.includes('Unique constraint') || msg.includes('P2002') ? 'duplicate_key' : 'failed' };
};

/** Partner self-service: update the NON-destination credentials — username + password only.
 *  Email and phone are OTP LOGIN destinations, so they can never be written here: proving
 *  control of a new destination requires the verify-before-commit flow below. (Previously this
 *  wrote a new phone/email immediately, so a partner could point the account's OTP login at a
 *  number/address they don't control — takeover — or typo it and lock themselves out.) */
export async function partnerUpdateAccount(input: { username: string; password: string }): Promise<Result> {
  const { userId } = await requirePartner();
  if (!rateLimit(`pacct:${userId}`, 5, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const username = input.username.trim().toLowerCase() || null;
  const newPassword = input.password.trim();
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'password_short' };
  const cur = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, passwordHash: true } });
  // Never leave the account with no way in. A login is either OTP (needs email or phone) or
  // password (needs an identifier — username/email/phone — AND a stored password).
  const willHavePassword = newPassword ? true : !!cur?.passwordHash;
  const otpRoute = !!cur?.email || !!cur?.phone;
  const passwordRoute = (!!username || !!cur?.email || !!cur?.phone) && willHavePassword;
  if (!otpRoute && !passwordRoute) return { ok: false, error: 'identifier_required' };
  try {
    const passPatch = newPassword ? { passwordHash: await hashPassword(newPassword) } : {};
    await prisma.user.update({ where: { id: userId }, data: { username, ...passPatch } });
    revalidatePath('/partner/account');
    return { ok: true };
  } catch (e) {
    return dupOrFail(e);
  }
}

/** Step 1 of an email/phone change: send a code to the NEW destination. Nothing is written —
 *  this only proves the partner can receive at that destination before it becomes a login route. */
export async function partnerRequestIdentifierChange(input: { field: 'email' | 'phone'; value: string; locale?: 'ar' | 'en' }): Promise<Result> {
  const { userId } = await requirePartner();
  if (!rateLimit(`pacctid:${userId}`, 5, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const locale: 'ar' | 'en' = input.locale === 'en' ? 'en' : 'ar';
  if (input.field === 'phone') {
    const phone = input.value.trim();
    if (!isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };
    // Reject a destination already tied to another account before spending an SMS on it.
    const clash = await prisma.user.findFirst({ where: { phone: normalizePhone(phone), id: { not: userId } }, select: { id: true } });
    if (clash) return { ok: false, error: 'duplicate_key' };
    return requestOtp(phone, locale, otpBrand());
  }
  const email = input.value.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };
  const clash = await prisma.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
  if (clash) return { ok: false, error: 'duplicate_key' };
  return requestEmailOtp(email, locale, otpBrand());
}

/** Step 2: verify the code for that destination, then commit that ONE field. verify*Otp keys on
 *  the same normalized destination request*Otp stored, so a code only validates for the exact
 *  address/number it was sent to. */
export async function partnerConfirmIdentifierChange(input: { field: 'email' | 'phone'; value: string; code: string }): Promise<Result> {
  const { userId } = await requirePartner();
  if (!rateLimit(`pacctid:${userId}`, 10, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const code = input.code.trim();
  try {
    if (input.field === 'phone') {
      const phone = input.value.trim();
      if (!isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };
      const v = await verifyOtp(phone, code);
      if (!v.ok) return { ok: false, error: 'bad_code' };
      await prisma.user.update({ where: { id: userId }, data: { phone: normalizePhone(phone) } });
    } else {
      const email = input.value.trim().toLowerCase();
      if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };
      const v = await verifyEmailOtp(email, code);
      if (!v.ok) return { ok: false, error: 'bad_code' };
      await prisma.user.update({ where: { id: userId }, data: { email } });
    }
    revalidatePath('/partner/account');
    return { ok: true };
  } catch (e) {
    return dupOrFail(e);
  }
}

/** Remove an email/phone login route. No OTP needed (removing, not adding), but at least one
 *  working login route must survive so the partner can't lock themselves out. */
export async function partnerClearIdentifier(input: { field: 'email' | 'phone' }): Promise<Result> {
  const { userId } = await requirePartner();
  if (!rateLimit(`pacctid:${userId}`, 10, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const cur = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, username: true, passwordHash: true } });
  if (!cur) return { ok: false, error: 'failed' };
  const after = { email: input.field === 'email' ? null : cur.email, phone: input.field === 'phone' ? null : cur.phone };
  const otpRoute = !!after.email || !!after.phone;
  const passwordRoute = (!!cur.username || !!after.email || !!after.phone) && !!cur.passwordHash;
  if (!otpRoute && !passwordRoute) return { ok: false, error: 'identifier_required' };
  await prisma.user.update({ where: { id: userId }, data: { [input.field]: null } });
  revalidatePath('/partner/account');
  return { ok: true };
}

// Fast edits are instant (owner decision: structural changes need approval, price and
// availability do not). Partners may only touch these statuses — never the moderation
// ones (DRAFT/PENDING/REJECTED stay staff-controlled).
const FAST_STATUSES = ['PUBLISHED', 'SOLD', 'ARCHIVED'] as const;
type FastStatus = (typeof FAST_STATUSES)[number];

/** Load a listing only if it belongs to the signed-in partner's Owner AND is not in the trash.
 *  Trash is meant to be inert and restore-only: without the `deletedAt` filter a stale dashboard
 *  could still reprice/restatus a row staff had deleted, so a later Restore returned different
 *  content than what was deleted. */
async function ownListing(listingId: string, ownerId: string) {
  return prisma.listing.findFirst({
    where: { id: listingId, ownerId, deletedAt: null },
    select: { id: true, ownerId: true, status: true },
  });
}

/** Instant price update on the partner's own listing. */
export async function partnerUpdatePrice(listingId: string, price: number | null): Promise<Result> {
  const { ownerId, userId } = await requirePartner();
  if (!rateLimit(`pfast:${userId}`, 30, 60 * 1000)) return { ok: false, error: 'rate_limited' };
  // One money rule (also bounds Decimal(14,2) — an out-of-range paste used to reach Prisma,
  // throw, and leave the dashboard row stuck in its busy state with no message).
  const parsed = parsePriceInput(price);
  if (!parsed.ok) return { ok: false, error: 'invalid' };
  const l = await ownListing(listingId, ownerId);
  if (!l) return { ok: false, error: 'forbidden' };
  // Same lifecycle rule as availability: moderation statuses stay staff-controlled.
  if (!FAST_STATUSES.includes(l.status as FastStatus)) return { ok: false, error: 'not_editable' };
  // Conditional write: the ownership/trash/status predicate is part of the UPDATE, so a staff
  // transfer, trash or moderation change landing between the read and the write can't be
  // overwritten (the previous bare-id update was TOCTOU-prone).
  const upd = await prisma.listing.updateMany({
    where: { id: listingId, ownerId, deletedAt: null, status: { in: [...FAST_STATUSES] } },
    data: { price: parsed.value, postersStale: true }, // price shows on the generated images
  });
  if (upd.count === 0) return { ok: false, error: 'conflict' };
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
  // Same one money rule for the recorded sale price (0 ⇒ null, never a literal «0 ج.م»).
  const parsedSold = parsePriceInput(soldPrice);
  if (!parsedSold.ok) return { ok: false, error: 'invalid' };
  // Conditional write — see partnerUpdatePrice.
  const upd = await prisma.listing.updateMany({
    where: { id: listingId, ownerId, deletedAt: null, status: { in: [...FAST_STATUSES] } },
    data: {
      status,
      soldPrice: status === 'SOLD' ? parsedSold.value : null,
    },
  });
  if (upd.count === 0) return { ok: false, error: 'conflict' };
  revalidatePath('/partner');
  return { ok: true };
}
