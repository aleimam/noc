'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Status = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
type Result = { ok: true } | { ok: false; error: string };

export async function setApplicationStatus(id: string, status: Status, note?: string): Promise<Result> {
  const user = await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.partnerApplication.update({
      where: { id },
      data: { status, reviewNote: note?.trim().slice(0, 2000) || null, reviewedById: user.id, reviewedAt: new Date() },
    });
    revalidatePath('/admin/marketplace/partner-applications');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteApplication(id: string): Promise<Result> {
  await requirePermission('marketplace', 'DELETE');
  try {
    await prisma.partnerApplication.delete({ where: { id } });
    revalidatePath('/admin/marketplace/partner-applications');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
