'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import type { ScanRow, ScanReport } from '../types';

type Result = { ok: true } | { ok: false; error: string };

/** Register uploaded scans (already stored via /api/upload) and recompute the match report. */
export async function registerScans(
  files: { fileName: string; path: string; mime: string; attachmentId?: string }[],
): Promise<Result> {
  await requirePermission('sheets', 'CREATE');
  if (!files.length) return { ok: false, error: 'no_file' };
  try {
    for (const f of files) {
      const fileName = f.fileName.trim();
      if (!fileName) continue;
      await prisma.rationingScan.upsert({
        where: { fileName },
        update: { path: f.path, mime: f.mime, attachmentId: f.attachmentId ?? null },
        create: { fileName, path: f.path, mime: f.mime, attachmentId: f.attachmentId ?? null },
      });
    }
    revalidatePath('/admin/rationing/scans');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('registerScans failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function deleteScan(id: string): Promise<Result> {
  await requirePermission('sheets', 'DELETE');
  try {
    await prisma.rationingScan.delete({ where: { id } });
    revalidatePath('/admin/rationing/scans');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('deleteScan failed', e);
    return { ok: false, error: 'failed' };
  }
}

export type ScanRecord = { id: string; applicantName: string; plotFullRef: string | null; plotNo: string; blockNo: string; cityName: string | null; originalOwner: string | null };

/** All applicant records tied to a scan (sheet.sourceFile == fileName). */
export async function recordsForScan(fileName: string): Promise<ScanRecord[]> {
  await requirePermission('sheets', 'VIEW');
  const rows = await prisma.rationingSheet.findMany({
    where: { sourceFile: fileName },
    orderBy: [{ plotNo: 'asc' }],
    include: { city: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    applicantName: r.applicantName,
    plotFullRef: r.plotFullRef,
    plotNo: r.plotNo,
    blockNo: r.blockNo,
    cityName: r.city?.name ?? null,
    originalOwner: r.originalOwner,
  }));
}

/** Build the matched / orphan / missing report from current scans + sheet sourceFiles. */
export async function buildScanReport(): Promise<ScanReport> {
  const [scans, sourceGroups] = await Promise.all([
    prisma.rationingScan.findMany({ orderBy: { fileName: 'asc' } }),
    prisma.rationingSheet.groupBy({
      by: ['sourceFile'],
      where: { sourceFile: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByFile = new Map<string, number>();
  for (const g of sourceGroups) if (g.sourceFile) countByFile.set(g.sourceFile, g._count._all);

  const scanFileNames = new Set(scans.map((s) => s.fileName));
  let matchedScans = 0;
  let orphanScans = 0;
  let rowsCovered = 0;
  const rows: ScanRow[] = scans.map((s) => {
    const n = countByFile.get(s.fileName) ?? 0;
    if (n > 0) {
      matchedScans++;
      rowsCovered += n;
    } else {
      orphanScans++;
    }
    return { id: s.id, fileName: s.fileName, path: s.path, matchedRows: n };
  });

  // distinct source files that have no uploaded scan yet
  let rowsMissing = 0;
  for (const file of countByFile.keys()) if (!scanFileNames.has(file)) rowsMissing++;

  return { matchedScans, orphanScans, rowsCovered, rowsMissing, scans: rows };
}
