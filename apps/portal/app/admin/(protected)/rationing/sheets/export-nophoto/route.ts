import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

// GET /admin/rationing/sheets/export-nophoto → full record list of every sheet whose
// source file has NO uploaded scan photo (or no source file at all). Matching is by
// fileName string against RationingScan (no FK).
export async function GET() {
  await requirePermission('sheets', 'VIEW');

  const scanNames = new Set(
    (await prisma.rationingScan.findMany({ select: { fileName: true } })).map((s) => s.fileName),
  );

  const sheets = await prisma.rationingSheet.findMany({
    include: { city: { select: { name: true } } },
    orderBy: [{ sourceFile: 'asc' }, { applicantName: 'asc' }],
  });
  const rows = sheets.filter((s) => !s.sourceFile || !scanNames.has(s.sourceFile));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('سجلات بلا صورة مطابقة');
  ws.columns = [
    { header: 'اسم مقدم الطلب / Applicant', key: 'applicantName', width: 34 },
    { header: 'المالك الأصلي / Original owner', key: 'originalOwner', width: 30 },
    { header: 'القطعة / Plot', key: 'plotNo', width: 12 },
    { header: 'البلوك / Block', key: 'blockNo', width: 12 },
    { header: 'المرجع الكامل / Full ref', key: 'plotFullRef', width: 18 },
    { header: 'الجمعية / City', key: 'city', width: 18 },
    { header: 'تاريخ الكشف / List date', key: 'listDate', width: 16 },
    { header: 'ملف المصدر / Source file', key: 'sourceFile', width: 30 },
    { header: 'السبب / Reason', key: 'reason', width: 26 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const s of rows) {
    ws.addRow({
      applicantName: s.applicantName,
      originalOwner: s.originalOwner ?? '',
      plotNo: s.plotNo,
      blockNo: s.blockNo ?? '',
      plotFullRef: s.plotFullRef ?? '',
      city: s.city?.name ?? '',
      listDate: s.listDate ? s.listDate.toISOString().slice(0, 10) : '',
      sourceFile: s.sourceFile ?? '',
      reason: s.sourceFile ? 'الصورة غير مرفوعة / photo not uploaded' : 'لا يوجد ملف مصدر / no source file',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rationing-no-photo-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
