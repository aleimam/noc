'use server';

import { revalidatePath } from 'next/cache';
import ExcelJS from 'exceljs';
import { auth, requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

type Result = { ok: true; count?: number } | { ok: false; error: string };

/** Coerce an exceljs cell value (string | number | richText | hyperlink | formula …) to trimmed text. */
function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'object') {
    const o = v as { richText?: { text?: string }[]; text?: unknown; result?: unknown; hyperlink?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text ?? '').join('').trim() || null;
    if (o.text != null) return String(o.text).trim() || null;
    if (o.result != null) return String(o.result).trim() || null;
    if (o.hyperlink != null) return String(o.hyperlink).trim() || null;
  }
  const s = String(v).trim();
  return s || null;
}

function asDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'object') {
    const o = v as { result?: unknown };
    if (o.result instanceof Date) return o.result;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export async function importSheets(formData: FormData): Promise<Result> {
  await requirePermission('sheets', 'CREATE');
  const session = await auth();
  const uploadedById = session?.user?.id ?? null;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' };

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return { ok: false, error: 'empty' };

    // Cells map by position to SHEET_COLUMNS: 1 number, 2 owner, 3 company, 4 piece,
    // 5 location, 6 member, 7 sheetDate, 8 paymentDate, 9 notes.
    const rows: {
      numberInSheet: string | null;
      ownerName: string;
      company: string | null;
      originalPiece: string | null;
      originalLocation: string | null;
      originalMember: string | null;
      sheetDate: Date | null;
      paymentDate: Date | null;
      sheetNotes: string | null;
    }[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row
      const c = (i: number) => row.getCell(i).value;
      const ownerName = txt(c(2));
      if (!ownerName) return; // skip rows with no owner name
      rows.push({
        numberInSheet: txt(c(1)),
        ownerName,
        company: txt(c(3)),
        originalPiece: txt(c(4)),
        originalLocation: txt(c(5)),
        originalMember: txt(c(6)),
        sheetDate: asDate(c(7)),
        paymentDate: asDate(c(8)),
        sheetNotes: txt(c(9)),
      });
    });

    if (!rows.length) return { ok: false, error: 'no_rows' };

    const batch = await prisma.sheetImportBatch.create({
      data: { fileName: file.name || 'upload.xlsx', rowCount: rows.length, uploadedById },
    });
    await prisma.rationingSheet.createMany({
      data: rows.map((r) => ({ ...r, batchId: batch.id, uploadedById })),
    });

    revalidatePath('/admin/rationing/sheets');
    revalidatePath('/admin/rationing');
    return { ok: true, count: rows.length };
  } catch (e) {
    console.error('importSheets failed', e);
    return { ok: false, error: 'parse_failed' };
  }
}

export async function deleteBatch(id: string): Promise<Result> {
  await requirePermission('sheets', 'DELETE');
  try {
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

export async function setInquiryStatus(id: string, status: 'OPEN' | 'MATCHED' | 'CLOSED'): Promise<Result> {
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
