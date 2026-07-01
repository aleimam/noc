import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

// GET /admin/rationing/sheets/export-plots → plot list (plot no + owner + block / full reference).
export async function GET() {
  await requirePermission('sheets', 'VIEW');

  const rows = await prisma.rationingSheet.findMany({
    orderBy: [{ plotNo: 'asc' }, { blockNo: 'asc' }],
    select: {
      plotNo: true,
      blockNo: true,
      plotFullRef: true,
      originalOwner: true,
      applicantName: true,
      city: { select: { name: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Plots');
  ws.columns = [
    { header: 'رقم القطعة / Plot No', key: 'plotNo', width: 16 },
    { header: 'رقم المربع / Block No', key: 'blockNo', width: 16 },
    { header: 'المرجع الكامل / Full Reference', key: 'plotFullRef', width: 28 },
    { header: 'المالك الأصلي / Original Owner', key: 'originalOwner', width: 26 },
    { header: 'المتقدّم / Applicant', key: 'applicantName', width: 26 },
    { header: 'المدينة / City', key: 'city', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      plotNo: r.plotNo,
      blockNo: r.blockNo,
      plotFullRef: r.plotFullRef ?? '',
      originalOwner: r.originalOwner ?? '',
      applicantName: r.applicantName,
      city: r.city?.name ?? '',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rationing-plots-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
