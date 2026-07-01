import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { SHEET_COLUMNS } from '../../columns';

const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

// GET /admin/rationing/sheets/export → every applicant record as .xlsx (full columns).
export async function GET() {
  await requirePermission('sheets', 'VIEW');

  const rows = await prisma.rationingSheet.findMany({
    orderBy: [{ plotNo: 'asc' }, { blockNo: 'asc' }],
    include: { city: { select: { name: true } } },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Records');
  ws.columns = SHEET_COLUMNS.map((c) => ({ header: `${c.ar} / ${c.en}`, key: c.key, width: 22 }));
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      applicantNo: r.applicantNo ?? '',
      applicantName: r.applicantName,
      plotNo: r.plotNo,
      blockNo: r.blockNo,
      plotFullRef: r.plotFullRef ?? '',
      city: r.city?.name ?? '',
      originalOwner: r.originalOwner ?? '',
      attendanceDay: r.attendanceDay ?? '',
      attendanceDate: fmtDate(r.attendanceDate),
      listDate: fmtDate(r.listDate),
      declarationRequired: r.declarationRequired ? 'Yes' : 'No',
      declarationDetails: r.declarationDetails ?? '',
      remarks: r.remarks ?? '',
      sourceFile: r.sourceFile ?? '',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rationing-records-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
