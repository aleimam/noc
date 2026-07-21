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

/** Detect page numbers missing from the middle of a «DD MM YYYY NN» filename sequence.
 *  Input = every KNOWN name (uploaded photos ∪ sheet sourceFiles); a serial absent from both
 *  means the page was probably never scanned nor typed. */
function findSerialGaps(names: Iterable<string>): { gaps: { label: string; presentCount: number; maxSerial: number; missing: string[] }[]; total: number } {
  type G = { serials: Set<number>; seps: Map<string, number>; exts: Map<string, number> };
  const groups = new Map<string, G>();
  for (const raw of names) {
    const ext = raw.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '.jpg';
    const base = raw.replace(/\.[a-z0-9]+$/i, '');
    const sep = base.includes('_') && !base.includes(' ') ? '_' : ' ';
    const m = base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().match(/^(\d{1,2}) (\d{1,2}) (\d{4}) (\d{1,3})$/);
    if (!m) continue;
    const label = `${m[1]!.padStart(2, '0')} ${m[2]!.padStart(2, '0')} ${m[3]}`;
    const g = groups.get(label) ?? { serials: new Set<number>(), seps: new Map(), exts: new Map() };
    g.serials.add(parseInt(m[4]!, 10));
    g.seps.set(sep, (g.seps.get(sep) ?? 0) + 1);
    g.exts.set(ext, (g.exts.get(ext) ?? 0) + 1);
    groups.set(label, g);
  }
  const top = (m: Map<string, number>, fallback: string) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  const gaps: { label: string; presentCount: number; maxSerial: number; missing: string[] }[] = [];
  let total = 0;
  for (const [label, g] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const max = Math.max(...g.serials);
    if (max < 2) continue;
    const sep = top(g.seps, ' ');
    const ext = top(g.exts, '.jpg');
    const missing: string[] = [];
    for (let n = 1; n <= max; n++) {
      if (!g.serials.has(n)) missing.push(label.split(' ').join(sep) + sep + String(n).padStart(2, '0') + ext);
    }
    if (missing.length) {
      gaps.push({ label, presentCount: g.serials.size, maxSerial: max, missing });
      total += missing.length;
    }
  }
  return { gaps, total };
}

/** Build the matched / orphan / missing report from current scans + sheet sourceFiles. */
export async function buildScanReport(): Promise<ScanReport> {
  // Exported server action → reachable directly. It returns scan filenames/paths and
  // import-batch metadata, so it needs the same gate as its sibling scan actions.
  await requirePermission('sheets', 'VIEW');
  const [scans, sourceGroups, batchGroups] = await Promise.all([
    prisma.rationingScan.findMany({ orderBy: { fileName: 'asc' } }),
    prisma.rationingSheet.groupBy({
      by: ['sourceFile'],
      where: { sourceFile: { not: null } },
      _count: { _all: true },
    }),
    // Which import batch(es) mention each source file — pins a missing photo to its Excel import.
    prisma.rationingSheet.groupBy({
      by: ['sourceFile', 'batchId'],
      where: { sourceFile: { not: null } },
    }),
  ]);

  const countByFile = new Map<string, number>();
  for (const g of sourceGroups) if (g.sourceFile) countByFile.set(g.sourceFile, g._count._all);

  const batchIds = [...new Set(batchGroups.map((g) => g.batchId).filter((b): b is string => !!b))];
  const batchNames = new Map(
    batchIds.length
      ? (await prisma.sheetImportBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, fileName: true } })).map((b) => [b.id, b.fileName])
      : [],
  );
  const batchesByFile = new Map<string, Set<string>>();
  for (const g of batchGroups) {
    if (!g.sourceFile) continue;
    const name = g.batchId ? batchNames.get(g.batchId) : null;
    if (!name) continue;
    const set = batchesByFile.get(g.sourceFile) ?? new Set<string>();
    set.add(name);
    batchesByFile.set(g.sourceFile, set);
  }

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
  const missingFiles: { sourceFile: string; rows: number; batches: string[] }[] = [];
  for (const [file, n] of countByFile) {
    if (!scanFileNames.has(file)) missingFiles.push({ sourceFile: file, rows: n, batches: [...(batchesByFile.get(file) ?? [])] });
  }
  missingFiles.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile, undefined, { numeric: true }));

  // Serial gaps across everything we know about (photos + referenced files).
  const { gaps: serialGaps, total: gapCount } = findSerialGaps([...scanFileNames, ...countByFile.keys()]);

  return { matchedScans, orphanScans, rowsCovered, rowsMissing: missingFiles.length, scans: rows, missingFiles, serialGaps, gapCount };
}

/** Fix a filename mismatch: rename a scan's match key to the sourceFile the sheet rows carry.
 *  Only touches the DB key (the stored image path is untouched), so it's fully reversible. */
export async function renameScan(id: string, newFileName: string): Promise<Result> {
  await requirePermission('sheets', 'UPDATE');
  const fileName = newFileName.trim();
  if (!fileName) return { ok: false, error: 'no_name' };
  try {
    const clash = await prisma.rationingScan.findUnique({ where: { fileName } });
    if (clash && clash.id !== id) return { ok: false, error: 'name_taken' };
    await prisma.rationingScan.update({ where: { id }, data: { fileName } });
    revalidatePath('/admin/rationing/scans');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('renameScan failed', e);
    return { ok: false, error: 'failed' };
  }
}
