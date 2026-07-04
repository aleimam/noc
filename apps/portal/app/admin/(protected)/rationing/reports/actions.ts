'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true } | { ok: false; error: string };

export async function setReportStatus(id: string, status: 'NEW' | 'DONE'): Promise<Result> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await prisma.missedSheetReport.update({ where: { id }, data: { status } });
    revalidatePath('/admin/rationing/reports');
    return { ok: true };
  } catch (e) {
    console.error('setReportStatus failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function deleteReport(id: string): Promise<Result> {
  await requirePermission('sheets', 'DELETE');
  try {
    // Unlink photos (files stay on disk; the rows become unowned drafts).
    await prisma.attachment.updateMany({
      where: { ownerType: 'MissedSheetReport', ownerId: id },
      data: { ownerType: null, ownerId: null },
    });
    await prisma.missedSheetReport.delete({ where: { id } });
    revalidatePath('/admin/rationing/reports');
    return { ok: true };
  } catch (e) {
    console.error('deleteReport failed', e);
    return { ok: false, error: 'failed' };
  }
}
