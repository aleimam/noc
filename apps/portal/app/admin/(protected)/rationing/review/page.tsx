import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ReviewClient } from './ReviewClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');

  const rows = await prisma.rationingSheet.findMany({
    where: { needsReview: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
    include: { city: { select: { name: true } } },
  });

  // Attach the scanned page (if one was uploaded) so admins can compare against the OCR data.
  const sourceFiles = [...new Set(rows.map((r) => r.sourceFile).filter((f): f is string => !!f))];
  const scans = sourceFiles.length
    ? await prisma.rationingScan.findMany({ where: { fileName: { in: sourceFiles } }, select: { fileName: true, path: true } })
    : [];
  const scanByFile = new Map(scans.map((s) => [s.fileName, s.path]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('reviewTitle')} <span className="text-base font-normal opacity-60">({rows.length})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <p className="text-sm opacity-70">{t('reviewHint')}</p>
      <ReviewClient
        rows={rows.map((r) => ({
          id: r.id,
          applicantName: r.applicantName,
          plotNo: r.plotNo ?? '',
          blockNo: r.blockNo ?? '',
          plotFullRef: r.plotFullRef,
          cityName: r.city?.name ?? null,
          originalOwner: r.originalOwner,
          remarks: r.remarks,
          scanPath: (r.sourceFile && scanByFile.get(r.sourceFile)) || null,
        }))}
      />
    </div>
  );
}
