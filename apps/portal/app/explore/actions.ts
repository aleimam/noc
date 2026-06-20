'use server';

import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

// Public action — a customer follows a geographic area to receive its updates.
export async function followArea(input: {
  name?: string;
  phone: string;
  note?: string;
  districtId?: string;
  neighborhoodId?: string;
  blockId?: string;
  landId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = input.phone?.trim();
  if (!phone) return { ok: false, error: 'invalid' };
  const session = await auth();
  let userId = session?.user?.id ?? null;
  if (!userId) {
    const u = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    userId = u?.id ?? null;
  }
  try {
    await prisma.landFollow.create({
      data: {
        phone,
        name: input.name?.trim() || null,
        note: input.note?.trim() || null,
        userId,
        districtId: input.districtId ?? null,
        neighborhoodId: input.neighborhoodId ?? null,
        blockId: input.blockId ?? null,
        landId: input.landId ?? null,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('followArea failed', e);
    return { ok: false, error: 'failed' };
  }
}
