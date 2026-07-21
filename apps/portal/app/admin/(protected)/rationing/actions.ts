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

  // How many active name-watch follows would this upload match? (Same rule as the
  // importer: a follow's nameNorm is a substring of a parsed name, + plot/block if set.)
  const watchMatches = await countWatchMatches(rows);

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
    summary: { total: rows.length, newCount, dupFileCount, dupServerCount, flaggedCount, newCities, watchMatches },
    rows: out,
  };
}

/** Count active WATCH follows that the given parsed rows would match (preview heads-up). */
async function countWatchMatches(rows: ParsedRow[]): Promise<number> {
  const follows = await prisma.rationingFollow.findMany({
    where: { kind: 'WATCH', status: 'active' },
    select: { nameNorm: true, plotNo: true, blockNo: true },
  });
  if (!follows.length) return 0;
  const parsed = rows.flatMap((r) =>
    r.names.map((n) => ({ norm: normalizeArabic(n), plotNorm: normalizeArabic(r.plotNo), blockNorm: normalizeArabic(r.blockNo) })),
  );
  let hits = 0;
  for (const f of follows) {
    if (!f.nameNorm) continue;
    const pn = f.plotNo ? normalizeArabic(f.plotNo) : null;
    const bn = f.blockNo ? normalizeArabic(f.blockNo) : null;
    if (parsed.some((p) => p.norm.includes(f.nameNorm) && (!pn || p.plotNorm === pn) && (!bn || p.blockNorm === bn))) hits++;
  }
  return hits;
}

type CommitResult = { ok: true; batchId: string; created: number; updated: number; duplicates: number; matchedWatchers: number } | { ok: false; error: string };

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

    // Alert customers whose WATCH follow now matches a row in this batch (req #7/#11),
    // and count them so the upload can report how many name-watchers it matched.
    let matchedWatchers = 0;
    try { matchedWatchers = await runWatcherMatch(batch.id); } catch (e) { console.error('notifyWatchers failed', e); }

    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    revalidatePath('/admin/rationing/watchers');
    return { ok: true, batchId: batch.id, created, updated, duplicates, matchedWatchers };
  } catch (e) {
    console.error('commitImport failed', e);
    return { ok: false, error: 'commit_failed' };
  }
}

function watchSmsBody(locale: 'ar' | 'en', url: string | null): string {
  if (locale === 'en') return `New Obour: your name appeared in a new rationing sheet.${url ? ' ' + url : ''}`;
  return `العبور الجديدة: ظهر اسمك في كشف تقنين جديد.${url ? ' ' + url : ''}`;
}

// Warmer, admin-curated congratulations message (sent from the watchers page after a human
// has reviewed the match). The TEXT is admin-editable (Setting `rationing.congratsSms`,
// JSON {ar,en}); `{name}` is replaced with the applicant's name and the sheet link is
// appended automatically. Defaults below apply until the admin customizes it.
const CONGRATS_KEY = 'rationing.congratsSms';
const CONGRATS_DEFAULTS = {
  ar: 'العبور الجديدة: مبروك! ظهر اسمك في كشوف التقنين. سيتواصل معك فريقنا هاتفيًا قريبًا.',
  en: 'New Obour: Congratulations! Your name appeared in the rationing sheets. Our team will call you shortly.',
};

async function loadCongratsTexts(): Promise<{ ar: string; en: string }> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: CONGRATS_KEY } });
    const p = row?.value ? (JSON.parse(row.value) as { ar?: string; en?: string }) : {};
    const ar = (p.ar ?? '').trim() || CONGRATS_DEFAULTS.ar;
    // English falls back to the Arabic text (better a readable Arabic SMS than a stale default).
    const en = (p.en ?? '').trim() || (p.ar ?? '').trim() || CONGRATS_DEFAULTS.en;
    return { ar, en };
  } catch {
    return CONGRATS_DEFAULTS;
  }
}

function renderCongrats(text: string, name: string, url: string | null): string {
  const body = text.replace(/\{name\}/g, name).trim();
  return url ? `${body} ${url}` : body;
}

/** The current congratulations texts (effective values incl. defaults) — feeds the editor. */
export async function getCongratsSms(): Promise<{ ar: string; en: string }> {
  await requirePermission('sheets', 'VIEW');
  return loadCongratsTexts();
}

/** Save the admin-edited congratulations SMS texts (Arabic required; English optional). */
export async function saveCongratsSmsText(ar: string, en: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  const a = (ar ?? '').trim().slice(0, 400);
  const e = (en ?? '').trim().slice(0, 400);
  if (!a) return { ok: false, error: 'empty' };
  try {
    const value = JSON.stringify({ ar: a, en: e });
    await prisma.setting.upsert({ where: { key: CONGRATS_KEY }, update: { value }, create: { key: CONGRATS_KEY, value } });
    revalidatePath('/admin/rationing/watchers');
    return { ok: true };
  } catch (err) {
    console.error('saveCongratsSmsText failed', err);
    return { ok: false, error: 'failed' };
  }
}

/**
 * Match active WATCH follows against sheets and alert the customer on each hit.
 * Scoped to one batch (on import) when `batchId` is given; otherwise scans EVERY
 * sheet — used by the admin "check existing sheets" button so a name that was
 * already in an older sheet before the person subscribed still gets caught.
 * Returns the number of follows newly moved to `matched`.
 */
async function runWatcherMatch(batchId?: string): Promise<number> {
  const follows = await prisma.rationingFollow.findMany({
    where: { kind: 'WATCH', status: 'active' },
    include: { user: { select: { phone: true, preference: { select: { locale: true } } } } },
  });
  if (!follows.length) return 0;

  const base = (process.env.PORTAL_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  let cfg: Awaited<ReturnType<typeof loadSmsConfig>> | null = null;
  let matched = 0;

  for (const f of follows) {
    if (!f.nameNorm) continue;
    const where: Prisma.RationingNameWhereInput = {
      normalized: { contains: f.nameNorm },
      sheet: {
        ...(batchId ? { batchId } : {}),
        ...(f.plotNo ? { plotNorm: normalizeArabic(f.plotNo) } : {}),
        ...(f.blockNo ? { blockNorm: normalizeArabic(f.blockNo) } : {}),
      },
    };
    const hit = await prisma.rationingName.findFirst({ where, select: { sheetId: true } });
    if (!hit) continue;

    // Claim the follow ATOMICALLY. The old unconditional update meant a scheduled import and a
    // manual "check existing sheets" running together could both pass the initial `active` read
    // and both send the same person an alert SMS.
    const claimed = await prisma.rationingFollow.updateMany({
      where: { id: f.id, status: 'active' },
      data: { status: 'matched', sheetId: hit.sheetId },
    });
    if (claimed.count === 0) continue; // another run already claimed it
    matched++;

    // Stamp lastNotifiedAt ONLY when the alert SMS actually goes out — otherwise the admin UI
    // would falsely show "alerted" for a phone-less follow or a failed send.
    if (f.user?.phone) {
      if (!cfg) cfg = await loadSmsConfig();
      const locale = (f.user.preference?.locale?.toLowerCase() === 'en' ? 'en' : 'ar') as 'ar' | 'en';
      const url = base ? `${base}/rationing/${hit.sheetId}` : null;
      const res = await sendSms(f.user.phone, watchSmsBody(locale, url), cfg).catch((e) => { console.error('watch sms failed', e); return null; });
      if (res?.ok) await prisma.rationingFollow.update({ where: { id: f.id }, data: { lastNotifiedAt: new Date() } });
    }
  }
  return matched;
}

/** Admin action: match all current watchers against every sheet already imported. */
export async function recheckWatchers(): Promise<{ ok: true; matched: number } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  try {
    const matched = await runWatcherMatch();
    revalidatePath('/admin/rationing/watchers');
    revalidatePath('/admin/rationing');
    return { ok: true, matched };
  } catch (e) {
    console.error('recheckWatchers failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Admin action: stop (`closed`) or resume (`active`) a WATCH follow. */
export async function setFollowStatus(id: string, status: 'active' | 'closed'): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await prisma.rationingFollow.update({ where: { id }, data: { status } });
    revalidatePath('/admin/rationing/watchers');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('setFollowStatus failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Admin action: permanently remove a WATCH follow. */
export async function deleteFollow(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'DELETE');
  try {
    await prisma.rationingFollow.delete({ where: { id } });
    revalidatePath('/admin/rationing/watchers');
    revalidatePath('/admin/rationing');
    return { ok: true };
  } catch (e) {
    console.error('deleteFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Admin action: send the curated congratulations SMS to the selected matched watchers.
 *  Skips any without a phone. Records `congratsAt` on each one actually sent. */
export async function sendCongratsSms(ids: string[]): Promise<{ ok: true; sent: number; skipped: number } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  if (!ids.length) return { ok: true, sent: 0, skipped: 0 };
  try {
    const follows = await prisma.rationingFollow.findMany({
      where: { id: { in: ids }, kind: 'WATCH' },
      include: { user: { select: { phone: true, preference: { select: { locale: true } } } } },
    });
    const base = (process.env.PORTAL_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
    const texts = await loadCongratsTexts(); // admin-editable message (defaults until customized)
    let cfg: Awaited<ReturnType<typeof loadSmsConfig>> | null = null;
    let sent = 0;
    let skipped = 0;
    for (const f of follows) {
      if (!f.user?.phone) { skipped++; continue; }
      if (!cfg) cfg = await loadSmsConfig();
      const locale = (f.user.preference?.locale?.toLowerCase() === 'en' ? 'en' : 'ar') as 'ar' | 'en';
      const url = base && f.sheetId ? `${base}/rationing/${f.sheetId}` : null;
      const body = renderCongrats(locale === 'en' ? texts.en : texts.ar, f.applicantName, url);
      const res = await sendSms(f.user.phone, body, cfg).catch((e) => { console.error('congrats sms failed', e); return null; });
      if (res?.ok) { await prisma.rationingFollow.update({ where: { id: f.id }, data: { congratsAt: new Date() } }); sent++; }
      else skipped++;
    }
    revalidatePath('/admin/rationing/watchers');
    return { ok: true, sent, skipped };
  } catch (e) {
    console.error('sendCongratsSms failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Admin action: mark the selected matched watchers as contacted-by-phone (→ Done). */
export async function markContacted(ids: string[]): Promise<{ ok: true; n: number } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  if (!ids.length) return { ok: true, n: 0 };
  try {
    const session = await auth();
    const by = session?.user?.email ?? session?.user?.id ?? null;
    const res = await prisma.rationingFollow.updateMany({
      where: { id: { in: ids }, kind: 'WATCH' },
      data: { contactedAt: new Date(), contactedBy: by },
    });
    revalidatePath('/admin/rationing/watchers');
    revalidatePath('/admin/rationing');
    return { ok: true, n: res.count };
  } catch (e) {
    console.error('markContacted failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Admin action: undo a contacted mark (send it back to the follow-up queue). */
export async function unmarkContacted(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('sheets', 'UPDATE');
  try {
    await prisma.rationingFollow.update({ where: { id }, data: { contactedAt: null, contactedBy: null } });
    revalidatePath('/admin/rationing/watchers');
    return { ok: true };
  } catch (e) {
    console.error('unmarkContacted failed', e);
    return { ok: false, error: 'failed' };
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
