'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

export type ReportInput = {
  reporterName?: string;
  reporterPhone?: string;
  fbDate?: string; // YYYY-MM-DD
  cityId?: string;
  originalOwner?: string;
  blockNo?: string;
  plotNo?: string;
  photoIds?: string[];
};

type Result = { ok: true; name: string } | { ok: false; error: string };

const clean = (v: string | undefined, max = 190) => (v ?? '').trim().slice(0, max);

export async function submitMissedSheetReport(input: ReportInput): Promise<Result> {
  // Anti-spam: a handful of reports per hour per IP is plenty for a real person.
  if (!rateLimit(`msr:${clientIp(await headers())}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: 'rate_limited' };
  }

  // Logged-in reporters: take name + phone from the account, never from the form.
  const session = await auth();
  let reporterName = '';
  let reporterPhone = '';
  let userId: string | null = null;
  if (session?.user) {
    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true } });
    userId = session.user.id;
    reporterName = clean(u?.name ?? '') || 'عميل مسجّل';
    reporterPhone = clean(u?.phone ?? '');
  } else {
    reporterName = clean(input.reporterName);
    reporterPhone = clean(input.reporterPhone).replace(/[\s()-]/g, '');
    if (reporterName.length < 2) return { ok: false, error: 'name_required' };
    if (!/^\+?\d{8,15}$/.test(reporterPhone)) return { ok: false, error: 'invalid_phone' };
  }

  const fbDateStr = clean(input.fbDate, 10);
  const fbDate = /^\d{4}-\d{2}-\d{2}$/.test(fbDateStr) ? new Date(`${fbDateStr}T00:00:00Z`) : null;
  const cityId = clean(input.cityId) || null;
  const originalOwner = clean(input.originalOwner) || null;
  const blockNo = clean(input.blockNo, 50) || null;
  const plotNo = clean(input.plotNo, 50) || null;
  const photoIds = (input.photoIds ?? []).filter((x) => typeof x === 'string').slice(0, 10);

  // A useful report needs at least one piece of information about the sheet.
  if (!fbDate && !cityId && !originalOwner && !blockNo && !plotNo && photoIds.length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (cityId) {
    const city = await prisma.rationingCity.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) return { ok: false, error: 'failed' };
  }

  try {
    const report = await prisma.missedSheetReport.create({
      data: { reporterName, reporterPhone, userId, fbDate, cityId, originalOwner, blockNo, plotNo },
    });
    if (photoIds.length) {
      // Claim only unowned draft uploads — a crafted id list can't steal existing files.
      await prisma.attachment.updateMany({
        where: { id: { in: photoIds }, ownerType: null },
        data: { ownerType: 'MissedSheetReport', ownerId: report.id },
      });
    }
    revalidatePath('/admin/rationing/reports');
    return { ok: true, name: reporterName };
  } catch (e) {
    console.error('submitMissedSheetReport failed', e);
    return { ok: false, error: 'failed' };
  }
}
