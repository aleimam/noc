'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Status = 'NEW' | 'REVIEWING' | 'ACCEPTED' | 'REJECTED';

export async function setOfferStatus(id: string, status: Status): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.landOffer.update({ where: { id }, data: { status } });
    revalidatePath('/admin/marketplace/offers');
    revalidatePath(`/admin/marketplace/offers/${id}`);
    return { ok: true };
  } catch (e) {
    console.error('setOfferStatus failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function saveOfferNote(id: string, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.landOffer.update({ where: { id }, data: { note: note.trim() || null } });
    revalidatePath(`/admin/marketplace/offers/${id}`);
    return { ok: true };
  } catch (e) {
    console.error('saveOfferNote failed', e);
    return { ok: false, error: 'failed' };
  }
}
