import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DuplicatesClient } from './DuplicatesClient';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
const MAX_GROUPS = 2000; // safety cap on distinct duplicate groups scanned

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';
  const sp = await searchParams;

  // All groups of records sharing a dedupeKey (normalized name | plot | block) — count > 1.
  const [groups, reviewedRows] = await Promise.all([
    prisma.rationingSheet.groupBy({
      by: ['dedupeKey'],
      _count: { _all: true },
      having: { dedupeKey: { _count: { gt: 1 } } },
      orderBy: { _count: { dedupeKey: 'desc' } },
      take: MAX_GROUPS,
    }),
    prisma.dedupeReview.findMany({ select: { dedupeKey: true } }),
  ]);
  // Groups already reviewed & confirmed "not a duplicate" live on the Reviewed page.
  const reviewed = new Set(reviewedRows.map((r) => r.dedupeKey));
  const allKeys = groups.map((g) => g.dedupeKey).filter((k) => !reviewed.has(k));

  const total = allKeys.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(totalPages, Math.max(1, parseInt(sp.page ?? '1', 10) || 1));
  const keys = allKeys.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const rows = keys.length
    ? await prisma.rationingSheet.findMany({
        where: { dedupeKey: { in: keys } },
        orderBy: [{ dedupeKey: 'asc' }, { createdAt: 'asc' }],
        include: { city: { select: { name: true } }, batch: { select: { fileName: true } } },
      })
    : [];

  // Match each record to its uploaded scan photo (sourceFile == RationingScan.fileName).
  const sourceFiles = [...new Set(rows.map((r) => r.sourceFile).filter((f): f is string => !!f))];
  const scans = sourceFiles.length
    ? await prisma.rationingScan.findMany({ where: { fileName: { in: sourceFiles } }, select: { fileName: true, path: true } })
    : [];
  const scanByFile = new Map(scans.map((s) => [s.fileName, s.path]));

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  const byKey = new Map<string, DupRow[]>();
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
      sourceFile: r.sourceFile,
      batchFile: r.batch?.fileName ?? null,
      scanPath: (r.sourceFile && scanByFile.get(r.sourceFile)) || null,
      createdAt: fmt(r.createdAt),
    });
    byKey.set(r.dedupeKey, arr);
  }
  const data = keys.map((k) => ({ key: k, rows: byKey.get(k) ?? [] })).filter((g) => g.rows.length > 1);

  const pageHref = (p: number) => `/admin/rationing/duplicates?page=${p}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('duplicatesTitle')} <span className="text-base font-normal opacity-60">({total})</span>
        </h1>
        <div className="flex items-center gap-3">
          <a href="/admin/rationing/duplicates/reviewed" className="text-sm text-accent">{t('reviewedDuplicates')} →</a>
          <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>
      <p className="text-sm opacity-70">{t('duplicatesHint')}</p>

      <DuplicatesClient groups={data} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          {page > 1 && <a href={pageHref(page - 1)} className="rounded-md border border-graphite/25 px-3 py-1.5 hover:bg-graphite/10">‹ {t('prev')}</a>}
          <span className="opacity-70">{t('pageOf', { page, total: totalPages })}</span>
          {page < totalPages && <a href={pageHref(page + 1)} className="rounded-md border border-graphite/25 px-3 py-1.5 hover:bg-graphite/10">{t('next')} ›</a>}
        </div>
      )}
    </div>
  );
}

type DupRow = {
  id: string;
  applicantName: string;
  plotNo: string;
  blockNo: string;
  plotFullRef: string | null;
  cityName: string | null;
  originalOwner: string | null;
  sourceFile: string | null;
  batchFile: string | null;
  scanPath: string | null;
  createdAt: string;
};
