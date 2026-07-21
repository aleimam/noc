'use server';

import { headers } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { clientIp, rateLimit } from '../../lib/rateLimit';

type InquiryInput = {
  kind: 'FOUND_FOLLOW' | 'NOT_FOUND_WATCH';
  ownerName: string;
  phone: string;
  company?: string;
  originalPiece?: string;
  originalLocation?: string;
  originalMember?: string;
  note?: string;
  matchedSheetId?: string;
};

// Public action — anyone can register interest. Links to an existing customer by phone when possible.
export async function registerInquiry(input: InquiryInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = input.phone?.trim();
  const ownerName = input.ownerName?.trim();
  if (!phone || !ownerName) return { ok: false, error: 'invalid' };
  if (!isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };

  // Public unauthenticated write → per-IP quota plus a global ceiling, per the lead-form
  // convention. Without these a bot could fill InquiryRequest (and the admin lead queue)
  // indefinitely; the OTP cooldown does not bound this path.
  const ip = clientIp(await headers());
  if (!rateLimit(`inquiry:${ip}`, 5, 10 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  if (!rateLimit('inquiry:global', 300, 60 * 60 * 1000)) return { ok: false, error: 'rate_limited' };

  const session = await auth();
  let userId = session?.user?.id ?? null;
  if (!userId) {
    const u = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    userId = u?.id ?? null;
  }

  try {
    await prisma.inquiryRequest.create({
      data: {
        kind: input.kind,
        ownerName,
        phone,
        company: input.company?.trim() || null,
        originalPiece: input.originalPiece?.trim() || null,
        originalLocation: input.originalLocation?.trim() || null,
        originalMember: input.originalMember?.trim() || null,
        note: input.note?.trim() || null,
        matchedSheetId: input.matchedSheetId || null,
        userId,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('registerInquiry failed', e);
    return { ok: false, error: 'failed' };
  }
}
