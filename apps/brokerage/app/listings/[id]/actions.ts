'use server';

import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

// Save a buyer lead. Anonymous visitors may send (name/phone optional); logged-in
// customers are linked. The client also opens WhatsApp to the central number.
export async function createContactRequest(input: {
  listingId: string;
  name?: string;
  phone?: string;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  try {
    await prisma.contactRequest.create({
      data: {
        listingId: input.listingId || null,
        userId: session?.user?.id ?? null,
        name: input.name?.trim() || null,
        phone: input.phone?.trim() || null,
        message: input.message?.trim() || null,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('createContactRequest failed', e);
    return { ok: false, error: 'failed' };
  }
}
