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
        rows={rows.map((r) => ({ id: r.id, applicantName: r.applicantName, plotFullRef: r.plotFullRef, cityName: r.city?.name ?? null, remarks: r.remarks }))}
      />
    </div>
  );
}
