import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

// GET /admin/rationing/scans/export → two sheets:
//   1) Photos with NO matching record (orphan scans)
//   2) Records with NO uploaded photo (source files missing a scan)
export async function GET() {
  await requirePermission('sheets', 'VIEW');

  const [scans, sourceGroups] = await Promise.all([
    prisma.rationingScan.findMany({ orderBy: { fileName: 'asc' }, select: { fileName: true, path: true, createdAt: true } }),
    prisma.rationingSheet.groupBy({ by: ['sourceFile'], where: { sourceFile: { not: null } }, _count: { _all: true } }),
  ]);

  const countByFile = new Map<string, number>();
  for (const g of sourceGroups) if (g.sourceFile) countByFile.set(g.sourceFile, g._count._all);
  const scanNames = new Set(scans.map((s) => s.fileName));

  const wb = new ExcelJS.Workbook();

  const orphan = wb.addWorksheet('صور بلا سجلات');
  orphan.columns = [
    { header: 'اسم الملف / File name', key: 'fileName', width: 34 },
    { header: 'الرابط / Path', key: 'path', width: 44 },
    { header: 'تاريخ الرفع / Uploaded', key: 'createdAt', width: 22 },
  ];
  orphan.getRow(1).font = { bold: true };
  for (const s of scans) {
    if ((countByFile.get(s.fileName) ?? 0) === 0) {
      orphan.addRow({ fileName: s.fileName, path: s.path, createdAt: s.createdAt.toISOString().slice(0, 16).replace('T', ' ') });
    }
  }

  const missing = wb.addWorksheet('سجلات بلا صور');
  missing.columns = [
    { header: 'ملف المصدر / Source file', key: 'sourceFile', width: 34 },
    { header: 'عدد السجلات / Records', key: 'records', width: 18 },
  ];
  missing.getRow(1).font = { bold: true };
  for (const [file, n] of countByFile) {
    if (!scanNames.has(file)) missing.addRow({ sourceFile: file, records: n });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rationing-scans-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
