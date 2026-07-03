// Seed the rationing module (Module 1, v2). If the sample workbook is present it is
// imported in full (cities + applicant rows + expanded names); otherwise a tiny sample
// is seeded. Idempotent: a fixed seed batch is wiped and recreated on every run.
import { prisma } from './db-client.mjs';
import * as XLSX from 'xlsx';
import fs from 'node:fs';

const BATCH_ID = 'seed_rationing_batch';
const SAMPLE_PATH = 'C:/Claude/NOC/input data/2026-06 Rationing - corrected.xlsx';

// ── inline copies of apps/portal/lib/rationing/text.ts (kept in sync) ──
const toLatin = (s) => s.replace(/[٠-٩۰-۹]/g, (d) => {
  const a = '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
  return a !== -1 ? String(a) : String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
});
function normalizeArabic(input) {
  if (!input) return '';
  let s = toLatin(String(input)).replace(/[ً-ٰٟـ]/g, '');
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/[ىئ]/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ء/g, '');
  return s.toLowerCase().replace(/[^ء-ي0-9a-z]/g, '');
}
function expandApplicantNames(raw) {
  const cell = (raw ?? '').trim();
  if (!cell) return [];
  const segs = cell.split(/[،,+.]/).map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 1) return [...new Set([cell])];
  const toks = segs.map((s) => s.split(/\s+/).filter(Boolean));
  let b = 0;
  for (let i = 1; i < toks.length; i++) if (toks[i].length >= toks[b].length) b = i;
  const base = toks[b];
  const floor = Math.min(base.length, 3);
  const out = [];
  segs.forEach((seg, i) => {
    const t = toks[i];
    if (i === b || t.length >= floor) out.push(t.join(' '));
    else out.push([...t, ...base.slice(t.length)].join(' '));
  });
  return [...new Set(out)];
}
const buildPlotFullRef = (p, bl) => (p && bl ? `قطعة ${p} - مربع ${bl}` : p ? `قطعة ${p}` : bl ? `مربع ${bl}` : '');
const dedupeKey = (n, p, bl) => [normalizeArabic(n), normalizeArabic(p), normalizeArabic(bl)].join('|');
const serialToDate = (n) => (!isFinite(n) || n < 20000 || n > 80000 ? null : new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000));
function asDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return serialToDate(v);
  const n = Number(v);
  return !isNaN(n) ? serialToDate(n) : null;
}
const txt = (v) => {
  if (v == null) return null;
  if (typeof v === 'object' && v.text != null) return String(v.text).trim() || null;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim() || null;
  const s = String(v).trim();
  return s || null;
};

async function main() {
  const staff = await prisma.user.findFirst({ where: { type: 'STAFF' }, select: { id: true } });

  // wipe previous seed batch (names cascade)
  await prisma.rationingSheet.deleteMany({ where: { batchId: BATCH_ID } });
  await prisma.sheetImportBatch.upsert({
    where: { id: BATCH_ID },
    update: { rowCount: 0, fileName: 'seed.xlsx', note: 'Seed data' },
    create: { id: BATCH_ID, fileName: 'seed.xlsx', note: 'Seed data', uploadedById: staff?.id ?? null },
  });

  let rows = [];
  if (fs.existsSync(SAMPLE_PATH)) {
    const wb = XLSX.read(fs.readFileSync(SAMPLE_PATH), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      const c = (col) => r[col]; // 0-indexed A..N
      const name = txt(c(1));
      const plot = txt(c(2)) ?? '';
      const block = txt(c(3)) ?? '';
      const explicitRef = txt(c(4));
      if (!name || (!plot && !explicitRef)) continue;
      rows.push({
        applicantNo: parseInt(txt(c(0)) ?? '', 10) || null,
        applicantName: name, plotNo: plot, blockNo: block,
        plotFullRef: explicitRef || buildPlotFullRef(plot, block),
        city: txt(c(5)), originalOwner: txt(c(6)), attendanceDay: txt(c(7)),
        attendanceDate: asDate(c(8)), listDate: asDate(c(9)),
        declarationRequired: (txt(c(10)) ?? '').toLowerCase() === 'yes',
        declarationDetails: txt(c(11)), remarks: txt(c(12)), sourceFile: txt(c(13)),
      });
    }
    console.log(`Parsed ${rows.length} rows from sample workbook.`);
  } else {
    rows = [
      { applicantNo: 1, applicantName: 'محمد منصور علي', plotNo: '2094', blockNo: '2', city: 'القادسية', originalOwner: 'صبري عبدالكريم عبدالجواد', attendanceDay: 'الأحد', attendanceDate: new Date('2026-06-01'), listDate: new Date('2026-06-01'), declarationRequired: false, plotFullRef: buildPlotFullRef('2094', '2'), declarationDetails: null, remarks: null, sourceFile: null },
    ];
  }

  // upsert cities
  const cityIds = new Map();
  for (const r of rows) {
    if (!r.city) continue;
    const norm = normalizeArabic(r.city);
    if (cityIds.has(norm)) continue;
    const city = await prisma.rationingCity.upsert({
      where: { normalized: norm }, update: {}, create: { name: r.city, normalized: norm }, select: { id: true },
    });
    cityIds.set(norm, city.id);
  }

  let created = 0;
  const seen = new Set();
  for (const r of rows) {
    const key = dedupeKey(r.applicantName, r.plotNo || r.plotFullRef, r.blockNo);
    if (seen.has(key)) continue; // collapse within-file dups
    seen.add(key);
    const sheet = await prisma.rationingSheet.create({
      data: {
        applicantNo: r.applicantNo, applicantName: r.applicantName, plotNo: r.plotNo, blockNo: r.blockNo,
        plotFullRef: r.plotFullRef, cityId: r.city ? cityIds.get(normalizeArabic(r.city)) ?? null : null,
        originalOwner: r.originalOwner, attendanceDay: r.attendanceDay, attendanceDate: r.attendanceDate,
        listDate: r.listDate, declarationRequired: r.declarationRequired, declarationDetails: r.declarationDetails,
        remarks: r.remarks, sourceFile: r.sourceFile,
        ownerNorm: normalizeArabic(r.originalOwner), plotNorm: normalizeArabic(r.plotNo), blockNorm: normalizeArabic(r.blockNo),
        dedupeKey: key, needsReview: !!r.remarks, batchId: BATCH_ID, uploadedById: staff?.id ?? null,
      },
    });
    const names = expandApplicantNames(r.applicantName);
    await prisma.rationingName.createMany({
      data: names.map((fullName, i) => ({ sheetId: sheet.id, fullName, normalized: normalizeArabic(fullName), isPrimary: i === 0 })),
    });
    created++;
  }

  await prisma.sheetImportBatch.update({ where: { id: BATCH_ID }, data: { rowCount: created, createdCount: created } });
  console.log(`✓ Seeded ${created} rationing rows, ${cityIds.size} cities.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
