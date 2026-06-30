// Parse a rationing-sheet workbook into structured rows. Shared by the admin
// preview and commit actions so both see identical parsing. Reads cells by POSITION
// per SHEET_COLUMNS (0-indexed columns A..N).
//
// Uses SheetJS (xlsx) rather than exceljs: the data pipeline emits XML with prefixed
// namespaces (<x:worksheet …>), which exceljs's parser cannot read but SheetJS handles.
import * as XLSX from 'xlsx';
import { buildPlotFullRef, dedupeKey, expandApplicantNames, normalizeArabic } from './text';

export type ParsedRow = {
  rowNumber: number;
  applicantNo: number | null;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string;
  city: string | null;
  originalOwner: string | null;
  attendanceDay: string | null;
  attendanceDate: Date | null;
  listDate: Date | null;
  declarationRequired: boolean;
  declarationDetails: string | null;
  remarks: string | null;
  sourceFile: string | null;
  names: string[]; // expanded people
  dedupeKey: string;
};

/** Coerce a SheetJS cell value (string | number | boolean | Date | null) to trimmed text. */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s || null;
}

/** Excel serial date → JS Date (epoch 1899-12-30). */
function serialToDate(n: number): Date | null {
  if (!isFinite(n) || n < 20000 || n > 80000) return null; // ~1954..2119, sane window
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
}

function asDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return serialToDate(v);
  const s = String(v);
  const asNum = Number(s);
  if (!isNaN(asNum) && s.trim() !== '') return serialToDate(asNum);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function asBool(v: unknown): boolean {
  const s = (txt(v) ?? '').toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === 'نعم';
}

function asInt(v: unknown): number | null {
  const s = txt(v);
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export type ParseResult = { ok: true; rows: ParsedRow[] } | { ok: false; error: string };

export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // No cellDates: keep date cells as Excel serials so serialToDate maps them to a
    // tz-stable UTC midnight (cellDates would shift date-only values by the local offset).
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws) return { ok: false, error: 'empty' };

    // Array-of-arrays; row 0 is the header. Columns map by position A..N.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });
    const rows: ParsedRow[] = [];

    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      if (!Array.isArray(r)) continue;
      const c = (col: number) => r[col]; // 0-indexed: 0=A=applicantNo, 1=B=applicantName…
      const applicantName = txt(c(1));
      const plotNo = txt(c(2)) ?? '';
      const block = txt(c(3)) ?? '';
      const explicitRef = txt(c(4));
      // A row needs a name and some plot identity — either a plot number OR a full
      // reference (the الكيلو 48 records use a contract-area reference, no plot/square).
      if (!applicantName || (!plotNo && !explicitRef)) continue;
      const fullRef = explicitRef || buildPlotFullRef(plotNo, block);
      rows.push({
        rowNumber: i + 1,
        applicantNo: asInt(c(0)),
        applicantName,
        plotNo,
        blockNo: block,
        plotFullRef: fullRef,
        city: txt(c(5)),
        originalOwner: txt(c(6)),
        attendanceDay: txt(c(7)),
        attendanceDate: asDate(c(8)),
        listDate: asDate(c(9)),
        declarationRequired: asBool(c(10)),
        declarationDetails: txt(c(11)),
        remarks: txt(c(12)),
        sourceFile: txt(c(13)),
        names: expandApplicantNames(applicantName),
        // dedupe on name + plot + block; when plot is absent fall back to the full ref
        dedupeKey: dedupeKey(applicantName, plotNo || fullRef, block),
      });
    }

    if (!rows.length) return { ok: false, error: 'no_rows' };
    return { ok: true, rows };
  } catch (e) {
    console.error('parseWorkbook failed', e);
    return { ok: false, error: 'parse_failed' };
  }
}

/** Distinct non-empty city names in import order, with their normalized form. */
export function distinctCities(rows: ParsedRow[]): { name: string; normalized: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    if (!r.city) continue;
    const norm = normalizeArabic(r.city);
    if (norm && !seen.has(norm)) seen.set(norm, r.city);
  }
  return [...seen.entries()].map(([normalized, name]) => ({ name, normalized }));
}
