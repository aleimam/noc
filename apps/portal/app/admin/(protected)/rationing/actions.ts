'use server';

import { revalidatePath } from 'next/cache';
import { auth, requirePermission, loadSmsConfig } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { sendSms } from '@noc/sms';
import { parseWorkbook, distinctCities, type ParsedRow } from '../../../../lib/rationing/import';
import { normalizeArabic, buildPlotFullRef, dedupeKey, expandApplicantNames } from '../../../../lib/rationing/text';
import type { PreviewRow, PreviewResult } from './types';

type Conflict = 'skip' | 'update' | 'keepBoth';

const SAMPLE_CAP = 300;

/** Step 1 — parse + analyse without writing anything. */
export async function previewImport(formData: FormData): Promise<PreviewResult> {
  await requirePermission('sheets', 'CREATE');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' };

  const parsed = await parseWorkbook(await file.arrayBuffer());
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const rows = parsed.rows;

  // Existing duplicate keys in the DB.
  const keys = [...new Set(rows.map((r) => r.dedupeKey))];
  const existing = await prisma.rationingSheet.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  const inDb = new Set(existing.map((e) => e.dedupeKey));

  // Cities already known.
  const cities = distinctCities(rows);
  const knownCities = await prisma.rationingCity.findMany({
    where: { normalized: { in: cities.map((c) => c.normalized) } },
    select: { normalized: true },
  });
  const knownSet = new Set(knownCities.map((c) => c.normalized));
  const newCities = cities.filter((c) => !knownSet.has(c.normalized)).map((c) => c.name);

  const seen = new Set<string>();
  let newCount = 0;
  let dupFileCount = 0;
  let dupServerCount = 0;
  let flaggedCount = 0;
  const out: PreviewRow[] = [];

  for (const r of rows) {
    const dupInDb = inDb.has(r.dedupeKey);
    const dupInFile = seen.has(r.dedupeKey);
    seen.add(r.dedupeKey);
    // Server duplicate takes precedence when a row is both already-on-server and repeated in-file.
    const status: PreviewRow['status'] = dupInDb ? 'dupServer' : dupInFile ? 'dupFile' : 'new';
    if (status === 'dupServer') dupServerCount++;
    else if (status === 'dupFile') dupFileCount++;
    else newCount++;
    const flagged = !!r.remarks;
    if (flagged) flaggedCount++;
    if (out.length < SAMPLE_CAP) {
      out.push({
        rowNumber: r.rowNumber,
        applicantName: r.applicantName,
        names: r.names,
        plotNo: r.plotNo,
        blockNo: r.blockNo,
        city: r.city,
        originalOwner: r.originalOwner,
        status,
        flagged,
      });
    }
  }

  return {
    ok: true,
    fileName: file.name || 'upload.xlsx',
    summary: { total: rows.length, newCount, dupFileCount, dupServerCount, flaggedCount, newCities },
    rows: out,
  };
}

type CommitResult = { ok: true; batchId: string; created: number; updated: number; duplicates: number } | { ok: false; error: string };

/** Upsert the cities referenced by the rows; return a normalized→id map. */
async function ensureCities(rows: ParsedRow[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const c of distinctCities(rows)) {
    const city = await prisma.rationingCity.upsert({
      where: { normalized: c.normalized },
      update: {},
      create: { name: c.name, normalized: c.normalized },
      select: { id: true, normalized: true },
    });
    map.set(city.normalized, city.id);
  }
  return map;
}

function rowData(r: ParsedRow, cityId: string | null, batchId: string, uploadedById: string | null) {
  return {
    applicantNo: r.applicantNo,
    applicantName: r.applicantName,
    plotNo: r.plotNo,
    blockNo: r.blockNo,
    plotFullRef: r.plotFullRef,
    cityId,
    originalOwner: r.originalOwner,
    attendanceDay: r.attendanceDay,
    attendanceDate: r.attendanceDate,
    listDate: r.listDate,
    declarationRequired: r.declarationRequired,
    declarationDetails: r.declarationDetails,
    remarks: r.remarks,
    sourceFile: r.sourceFile,
    ownerNorm: normalizeArabic(r.originalOwner),
    plotNorm: normalizeArabic(r.plotNo),
    blockNorm: normalizeArabic(r.blockNo),
    dedupeKey: r.dedupeKey,
    needsReview: !!r.remarks,
    batchId,
    uploadedById,
  };
}

function nameRows(r: ParsedRow) {
  return r.names.map((fullName, i) => ({
    fullName,
    normalized: normalizeArabic(fullName),
    isPrimary: i === 0,
  }));
}

/** Step 2 — write. `conflict` decides what happens to rows already in the DB. */
export async function commitImport(formData: FormData): Promise<CommitResult> {
  await requirePermission('sheets', 'CREATE');
  const session = await auth();
  const uploadedById = session?.user?.id ?? null;

  // Two independent policies: within-file repeats default to keepBoth; server-side
  // duplicates default to skip (mirrors how staff usually work).
  const fileConflict = (String(formData.get('fileConflict') || 'keepBoth') as Conflict);
  const serverConflict = (String(formData.get('serverConflict') || 'skip') as Conflict);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' };

  const parsed = await parseWorkbook(await file.arrayBuffer());
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const rows = parsed.rows;

  try {
    const cityMap = await ensureCities(rows);

    // Map existing rows by dedupeKey (for skip/update).
    const keys = [...new Set(rows.map((r) => r.dedupeKey))];
    const existing = await prisma.rationingSheet.findMany({
      where: { dedupeKey: { in: keys } },
      select: { id: true, dedupeKey: true },
    });
    const existingByKey = new Map(existing.map((e) => [e.dedupeKey, e.id]));

    const batch = await prisma.sheetImportBatch.create({
      data: { fileName: file.name || 'upload.xlsx', uploadedById },
    });

    let created = 0;
    let updated = 0;
    let duplicates = 0;
    let flagged = 0;
    const seen = new Set<string>();

    for (const r of rows) {
      const cityId = r.city ? cityMap.get(normalizeArabic(r.city)) ?? null : null;
      const dupInFile = seen.has(r.dedupeKey);
      seen.add(r.dedupeKey);
      const existingId = existingByKey.get(r.dedupeKey);
      // Server duplicate wins over in-file when both apply; pick that row's policy.
      const conflict: Conflict | null = existingId ? serverConflict : dupInFile ? fileConflict : null;

      if (conflict === 'skip') {
        duplicates++;
        continue;
      }
      if (conflict === 'update' && existingId) {
        await prisma.rationingSheet.update({
          where: { id: existingId },
          data: rowData(r, cityId, batch.id, uploadedById),
        });
        await prisma.rationingName.deleteMany({ where: { sheetId: existingId } });
        await prisma.rationingName.createMany({
          data: nameRows(r).map((n) => ({ ...n, sheetId: existingId })),
        });
        updated++;
        if (r.remarks) flagged++;
        continue;
      }
      // new row, OR keepBoth (server/file), OR 'update' of a within-file dup (no existing) → insert
      const sheet = await prisma.rationingSheet.create({ data: rowData(r, cityId, batch.id, uploadedById) });
      await prisma.rationingName.createMany({
        data: nameRows(r).map((n) => ({ ...n, sheetId: sheet.id })),
      });
      if (conflict) duplicates++; // keepBoth still counts the collision
      created++;
      if (r.remarks) flagged++;
    }

    await prisma.sheetImportBatch.update({
      where: { id: batch.id },
      data: { rowCount: created + updated, createdCount: created, updatedCount: updated, duplicateCount: duplicates, flaggedCount: flagged },
    });

    // Alert customers whose WATCH follow now matches a row in this batch (req #7/#11).
    await notifyWatchers(batch.id).catch((e) => console.error('notifyWatchers failed', e));

    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    return { ok: true, batchId: batch.id, created, updated, duplicates };
  } catch (e) {
    console.error('commitImport failed', e);
    return { ok: false, error: 'commit_failed' };
  }
}

function watchSmsBody(locale: 'ar' | 'en', url: string | null): string {
  if (locale === 'en') return `New Obour: your name appeared in a new rationing sheet.${url ? ' ' + url : ''}`;
  return `العبور الجديد: ظهر اسمك في كشف تقنين جديد.${url ? ' ' + url : ''}`;
}

/** For each active WATCH follow, see if this batch contains a matching row; if so, SMS the customer. */
async function notifyWatchers(batchId: string): Promise<void> {
  const follows = await prisma.rationingFollow.findMany({
    where: { kind: 'WATCH', status: 'active' },
    include: { user: { select: { phone: true, preference: { select: { locale: true } } } } },
  });
  if (!follows.length) return;

  const base = (process.env.PORTAL_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  let cfg: Awaited<ReturnType<typeof loadSmsConfig>> | null = null;

  for (const f of follows) {
    if (!f.nameNorm) continue;
    const where: Prisma.RationingNameWhereInput = {
      normalized: { contains: f.nameNorm },
      sheet: {
        batchId,
        ...(f.plotNo ? { plotNorm: normalizeArabic(f.plotNo) } : {}),
        ...(f.blockNo ? { blockNorm: normalizeArabic(f.blockNo) } : {}),
      },
    };
    const hit = await prisma.rationingName.findFirst({ where, select: { sheetId: true } });
    if (!hit) continue;

    await prisma.rationingFollow.update({
      where: { id: f.id },
      data: { status: 'matched', sheetId: hit.sheetId, lastNotifiedAt: new Date() },
    });

    if (f.user?.phone) {
      if (!cfg) cfg = await loadSmsConfig();
      const locale = (f.user.preference?.locale?.toLowerCase() === 'en' ? 'en' : 'ar') as 'ar' | 'en';
      const url = base ? `${base}/rationing/${hit.sheetId}` : null;
      await sendSms(f.user.phone, watchSmsBody(locale, url), cfg).catch((e) => console.error('watch sms failed', e));
    }
  }
}

export async function deleteBatch(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'DELETE');
  try {
    // RationingName rows cascade via the sheet FK; delete sheets then the batch.
    await prisma.rationingSheet.deleteMany({ where: { batchId: id } });
    await prisma.sheetImportBatch.delete({ where: { id } });
    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('deleteBatch failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Edit a single applicant record (from the duplicates screen). Recomputes the search
 *  norms + dedupeKey and rebuilds the expanded names, so a correction naturally moves the
 *  row out of its duplicate group. */
export async function updateSheet(input: {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  originalOwner?: string;
  city?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  const applicantName = input.applicantName.trim();
  const plotNo = input.plotNo.trim();
  const blockNo = input.blockNo.trim();
  const originalOwner = input.originalOwner?.trim() || null;
  const cityName = input.city?.trim() || null;
  if (!applicantName || (!plotNo && !blockNo)) return { ok: false, error: 'required' };

  try {
    let cityId: string | null = null;
    if (cityName) {
      const norm = normalizeArabic(cityName);
      const c = await prisma.rationingCity.upsert({ where: { normalized: norm }, update: {}, create: { name: cityName, normalized: norm }, select: { id: true } });
      cityId = c.id;
    }
    const plotFullRef = buildPlotFullRef(plotNo, blockNo);
    const key = dedupeKey(applicantName, plotNo || plotFullRef, blockNo);
    await prisma.$transaction(async (tx) => {
      await tx.rationingSheet.update({
        where: { id: input.id },
        data: {
          applicantName,
          plotNo,
          blockNo,
          plotFullRef,
          originalOwner,
          cityId,
          ownerNorm: normalizeArabic(originalOwner),
          plotNorm: normalizeArabic(plotNo),
          blockNorm: normalizeArabic(blockNo),
          dedupeKey: key,
        },
      });
      await tx.rationingName.deleteMany({ where: { sheetId: input.id } });
      const names = expandApplicantNames(applicantName);
      await tx.rationingName.createMany({ data: names.map((fullName, i) => ({ sheetId: input.id, fullName, normalized: normalizeArabic(fullName), isPrimary: i === 0 })) });
    });
    revalidatePath('/admin/rationing/duplicates');
    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('updateSheet failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Delete a single applicant record (used from the duplicates cleanup screen). */
export async function deleteSheet(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'DELETE');
  try {
    await prisma.rationingSheet.delete({ where: { id } }); // RationingName rows cascade
    revalidatePath('/admin/rationing/duplicates');
    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('deleteSheet failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Mark a duplicate group (by dedupeKey) as reviewed & confirmed NOT a duplicate. */
export async function markDupReviewed(dedupeKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  const session = await auth();
  try {
    await prisma.dedupeReview.upsert({
      where: { dedupeKey },
      update: {},
      create: { dedupeKey, reviewedById: session?.user?.id ?? null },
    });
    revalidatePath('/admin/rationing/duplicates');
    revalidatePath('/admin/rationing/duplicates/reviewed');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('markDupReviewed failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Move a reviewed group back to the active duplicates list. */
export async function unmarkDupReviewed(dedupeKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await prisma.dedupeReview.deleteMany({ where: { dedupeKey } });
    revalidatePath('/admin/rationing/duplicates');
    revalidatePath('/admin/rationing/duplicates/reviewed');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('unmarkDupReviewed failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function setInquiryStatus(id: string, status: 'OPEN' | 'MATCHED' | 'CLOSED'): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await prisma.inquiryRequest.update({ where: { id }, data: { status } });
    revalidatePath('/admin/rationing/inquiries');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('setInquiryStatus failed', e);
    return { ok: false, error: 'failed' };
  }
}
