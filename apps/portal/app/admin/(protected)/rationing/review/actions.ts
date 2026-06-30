'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { dedupeKey, expandApplicantNames, normalizeArabic } from '../../../../../lib/rationing/text';

type Result = { ok: true } | { ok: false; error: string };

/** Correct a flagged row's applicant name (re-expanding its searchable aliases) and clear the flag. */
export async function reviewRow(id: string, newName?: string): Promise<Result> {
  await requirePermission('sheets', 'UPDATE');
  try {
    const sheet = await prisma.rationingSheet.findUnique({ where: { id }, select: { applicantName: true, plotNo: true, plotFullRef: true, blockNo: true } });
    if (!sheet) return { ok: false, error: 'not_found' };

    const name = newName?.trim();
    const changed = !!name && name !== sheet.applicantName;

    if (changed) {
      await prisma.rationingSheet.update({
        where: { id },
        data: {
          applicantName: name!,
          dedupeKey: dedupeKey(name!, sheet.plotNo || sheet.plotFullRef || '', sheet.blockNo),
          needsReview: false,
          reviewedAt: new Date(),
        },
      });
      await prisma.rationingName.deleteMany({ where: { sheetId: id } });
      const names = expandApplicantNames(name!);
      await prisma.rationingName.createMany({
        data: names.map((fullName, i) => ({ sheetId: id, fullName, normalized: normalizeArabic(fullName), isPrimary: i === 0 })),
      });
    } else {
      await prisma.rationingSheet.update({ where: { id }, data: { needsReview: false, reviewedAt: new Date() } });
    }

    revalidatePath('/admin/rationing/review');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('reviewRow failed', e);
    return { ok: false, error: 'failed' };
  }
}
