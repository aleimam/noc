import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { DuplicatesClient } from './DuplicatesClient';

export const dynamic = 'force-dynamic';

const MAX_GROUPS = 200;

export default async function DuplicatesPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';

  // Groups of records sharing a dedupeKey (normalized name | plot | block) — count > 1.
  const groups = await prisma.rationingSheet.groupBy({
    by: ['dedupeKey'],
    _count: { _all: true },
    having: { dedupeKey: { _count: { gt: 1 } } },
    orderBy: { _count: { dedupeKey: 'desc' } },
    take: MAX_GROUPS,
  });
  const keys = groups.map((g) => g.dedupeKey);

  const rows = keys.length
    ? await prisma.rationingSheet.findMany({
        where: { dedupeKey: { in: keys } },
        orderBy: [{ dedupeKey: 'asc' }, { createdAt: 'asc' }],
        include: { city: { select: { name: true } }, batch: { select: { fileName: true } } },
      })
    : [];

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
      createdAt: fmt(r.createdAt),
    });
    byKey.set(r.dedupeKey, arr);
  }
  const data = keys.map((k) => ({ key: k, rows: byKey.get(k) ?? [] })).filter((g) => g.rows.length > 1);
  const totalDupRows = data.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('duplicatesTitle')} <span className="text-base font-normal opacity-60">({data.length})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>
      <p className="text-sm opacity-70">{t('duplicatesHint')}</p>
      <DuplicatesClient groups={data} totalDupRows={totalDupRows} capped={groups.length >= MAX_GROUPS} />
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
  createdAt: string;
};
