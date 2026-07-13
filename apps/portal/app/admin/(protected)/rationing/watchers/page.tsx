import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { WatcherActions, RecheckWatchersButton } from '../WatchersClient';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-gold/20 text-graphite',
  matched: 'bg-green/15 text-green',
  closed: 'bg-graphite/10 opacity-70',
};

const FILTERS = ['all', 'active', 'matched', 'closed'] as const;
type Filter = (typeof FILTERS)[number];

function fmtDateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function WatchersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? '') ? (sp.status as Filter) : 'all';

  const [rows, grouped] = await Promise.all([
    prisma.rationingFollow.findMany({
      where: { kind: 'WATCH', ...(filter !== 'all' ? { status: filter } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { phone: true } },
        city: { select: { name: true, nameEn: true } },
        sheet: { select: { id: true, applicantName: true, plotFullRef: true } },
      },
    }),
    prisma.rationingFollow.groupBy({ by: ['status'], where: { kind: 'WATCH' }, _count: { _all: true } }),
  ]);

  const count = (s: Filter) => (s === 'all' ? grouped.reduce((n, g) => n + g._count._all, 0) : grouped.find((g) => g.status === s)?._count._all ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {t('watchersTitle')} <span className="text-base font-normal opacity-60">({count('all')})</span>
          </h1>
          <p className="text-sm opacity-70">{t('watchersHint')}</p>
        </div>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
        <RecheckWatchersButton />
        <p className="mt-2 text-xs opacity-70">{t('recheckHint')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <a
            key={f}
            href={f === 'all' ? '/admin/rationing/watchers' : `/admin/rationing/watchers?status=${f}`}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-accent bg-accent/10 text-accent' : 'border-graphite/20 opacity-80 hover:border-accent'}`}
          >
            {f === 'all' ? t('filterAll') : t(`status${f}`)} <span className="opacity-60">({count(f)})</span>
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noWatchers')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('colApplicant')}</th>
                <th className="p-2 text-start">{t('colPlot')}</th>
                <th className="p-2 text-start">{t('colBlock')}</th>
                <th className="p-2 text-start">{t('colOwner')}</th>
                <th className="p-2 text-start">{t('colCity')}</th>
                <th className="p-2 text-start">{t('phone')}</th>
                <th className="p-2 text-start">{t('status')}</th>
                <th className="p-2 text-start">{t('matchedSheet')}</th>
                <th className="p-2 text-start">{t('when')}</th>
                <th className="p-2 text-start">{t('lastNotified')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">{f.applicantName}</td>
                  <td className="p-2">{f.plotNo ?? '—'}</td>
                  <td className="p-2">{f.blockNo ?? '—'}</td>
                  <td className="p-2">{f.originalOwner ?? '—'}</td>
                  <td className="p-2">{f.city ? L(f.city.name, f.city.nameEn || f.city.name) : '—'}</td>
                  <td className="p-2" dir="ltr">{f.user?.phone ?? '—'}</td>
                  <td className="p-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[f.status] ?? ''}`}>{t(`status${f.status}`)}</span>
                  </td>
                  <td className="p-2">
                    {f.sheet ? (
                      <a href={`/rationing/${f.sheet.id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {f.sheet.applicantName}{f.sheet.plotFullRef ? ` · ${f.sheet.plotFullRef}` : ''}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2" dir="ltr">{fmtDateTime(f.createdAt, locale)}</td>
                  <td className="p-2" dir="ltr">{f.lastNotifiedAt ? fmtDateTime(f.lastNotifiedAt, locale) : '—'}</td>
                  <td className="p-2 text-end">
                    <WatcherActions id={f.id} status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {count(filter) > rows.length && (
            <p className="p-2 text-center text-xs opacity-60">{t('previewCapped', { shown: rows.length, total: count(filter) })}</p>
          )}
        </div>
      )}
    </div>
  );
}
