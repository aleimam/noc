'use server';

import { headers } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

// Save a buyer lead. Anonymous visitors may send (name/phone optional); logged-in
// customers are linked. The client also opens WhatsApp to the central number.
export async function createContactRequest(input: {
  listingId: string;
  name?: string;
  phone?: string;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rateLimit(`lead:${clientIp(await headers())}`, 15, 60 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const session = await auth();
  if (input.phone?.trim() && !isValidPhone(input.phone)) return { ok: false, error: 'invalid_phone' };
  const cap = (v: string | undefined, n: number) => {
    const s = (v ?? '').trim();
    return s ? s.slice(0, n) : null;
  };
  try {
    await prisma.contactRequest.create({
      data: {
        listingId: input.listingId || null,
        userId: session?.user?.id ?? null,
        name: cap(input.name, 120),
        phone: cap(input.phone, 30),
        message: cap(input.message, 2000),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('createContactRequest failed', e);
    return { ok: false, error: 'failed' };
  }
}
