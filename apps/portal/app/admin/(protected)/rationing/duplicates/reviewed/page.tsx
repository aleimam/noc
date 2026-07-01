import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ReviewedDuplicatesClient } from './ReviewedDuplicatesClient';

export const dynamic = 'force-dynamic';

export default async function ReviewedDuplicatesPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';

  const reviews = await prisma.dedupeReview.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  const keys = reviews.map((r) => r.dedupeKey);
  const rows = keys.length
    ? await prisma.rationingSheet.findMany({
        where: { dedupeKey: { in: keys } },
        orderBy: [{ dedupeKey: 'asc' }, { createdAt: 'asc' }],
        include: { city: { select: { name: true } } },
      })
    : [];

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byKey.get(r.dedupeKey) ?? [];
    arr.push({
      id: r.id,
      applicantName: r.applicantName,
      plotNo: r.plotNo,
      blockNo: r.blockNo,
      plotFullRef: r.plotFullRef,
      cityName: r.city?.name ?? null,
      originalOwner: r.originalOwner,
    });
    byKey.set(r.dedupeKey, arr);
  }
  const data = reviews.map((rv) => ({ key: rv.dedupeKey, reviewedAt: fmt(rv.createdAt), rows: byKey.get(rv.dedupeKey) ?? [] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('reviewedDuplicates')} <span className="text-base font-normal opacity-60">({data.length})</span>
        </h1>
        <div className="flex items-center gap-3">
          <a href="/admin/rationing/duplicates" className="text-sm text-accent">← {t('duplicatesTitle')}</a>
        </div>
      </div>
      <p className="text-sm opacity-70">{t('reviewedDuplicatesHint')}</p>
      <ReviewedDuplicatesClient groups={data} />
    </div>
  );
}

type Row = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  cityName: string | null;
  originalOwner: string | null;
};
