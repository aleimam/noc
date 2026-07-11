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

export async function deleteOffer(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'DELETE');
  try {
    // Unlink the offer's photos (files stay on disk; rows become unowned drafts).
    await prisma.attachment.updateMany({
      where: { ownerType: 'LandOffer', ownerId: id },
      data: { ownerType: null, ownerId: null },
    });
    await prisma.landOffer.delete({ where: { id } });
    revalidatePath('/admin/marketplace/offers');
    return { ok: true };
  } catch (e) {
    console.error('deleteOffer failed', e);
    return { ok: false, error: 'failed' };
  }
}
