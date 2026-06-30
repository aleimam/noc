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
    applicantNo: 1,
    applicantName: 'محمد منصور علي',
    plotNo: '2094',
    blockNo: '2',
    plotFullRef: 'قطعة 2094 - مربع 2',
    city: 'القادسية',
    originalOwner: 'صبري عبدالكريم عبدالجواد',
    attendanceDay: 'الأحد',
    attendanceDate: '2026-06-01',
    listDate: '2026-06-01',
    declarationRequired: 'No',
    declarationDetails: '',
    remarks: '',
    sourceFile: '1 06 2026 02.jpg',
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rationing-sheets-template.xlsx"',
    },
  });
}
