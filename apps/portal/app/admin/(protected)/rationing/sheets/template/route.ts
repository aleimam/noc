import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission } from '@noc/auth';
import { SHEET_COLUMNS } from '../../columns';

// GET /admin/rationing/sheets/template → downloadable .xlsx the staff fills and re-imports.
export async function GET() {
  await requirePermission('sheets', 'VIEW');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheets');
  ws.columns = SHEET_COLUMNS.map((c) => ({ header: `${c.ar} / ${c.en}`, key: c.key, width: 22 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    numberInSheet: '1',
    ownerName: 'محمد أحمد',
    company: 'جمعية الأمل',
    originalPiece: '125',
    originalLocation: 'القادسية',
    originalMember: '457',
    sheetDate: '2018-03-12',
    paymentDate: '2019-06-01',
    sheetNotes: 'سداد كامل',
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rationing-sheets-template.xlsx"',
    },
  });
}
