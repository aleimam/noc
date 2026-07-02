import { prisma } from '@noc/db';
import { normalizePhone, requestOtp, verifyOtp } from '@noc/auth';

// Shared logic for the no-login "follow" forms (rationing watch/found + land area).
//
// The rule (product decision): a brand-new phone number is trusted — we create a
// lightweight, unverified CUSTOMER account and attach the follow immediately, so a
// low-tech visitor never faces a code on their first follow. A phone that already has
// an account might belong to someone else, so we require an OTP before touching it;
// verifying also promotes that account to "verified".

export type BeginFollow =
  | { kind: 'ready'; userId: string } // logged in, or a fresh account was just created
  | { kind: 'otp_sent' } // an account already exists for this phone — verify next
  | { kind: 'error'; error: string };

export async function beginPhoneFollow(
  rawPhone: string,
  sessionUserId: string | null,
  locale: 'ar' | 'en',
): Promise<BeginFollow> {
  if (sessionUserId) return { kind: 'ready', userId: sessionUserId };

  const phone = normalizePhone(rawPhone);
  if (!/^\+?\d{8,15}$/.test(phone)) return { kind: 'error', error: 'invalid_phone' };

  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (!existing) {
    // Unverified account (phoneVerifiedAt stays null); admin can verify or prune it later.
    const u = await prisma.user.create({ data: { type: 'CUSTOMER', phone } });
    return { kind: 'ready', userId: u.id };
  }

  const r = await requestOtp(phone, locale);
  if (!r.ok) return { kind: 'error', error: r.error };
  return { kind: 'otp_sent' };
}

export async function completePhoneFollow(
  rawPhone: string,
  code: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const res = await verifyOtp(rawPhone, code);
  if (!res.ok) return { ok: false, error: res.error };
  const u = await prisma.user.upsert({
    where: { phone: res.phone },
    update: { phoneVerifiedAt: new Date(), isActive: true },
    create: { type: 'CUSTOMER', phone: res.phone, phoneVerifiedAt: new Date() },
  });
  return { ok: true, userId: u.id };
}
