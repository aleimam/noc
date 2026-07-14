import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { WatcherActions, RecheckWatchersButton, FollowupTable, type FollowRow } from '../WatchersClient';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-gold/20 text-graphite',
  matched: 'bg-green/15 text-green',
  closed: 'bg-graphite/10 opacity-70',
};

const FILTERS = ['all', 'active', 'followup', 'contacted', 'closed'] as const;
type Filter = (typeof FILTERS)[number];

function fmtDateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function whereFor(filter: Filter): Prisma.RationingFollowWhereInput {
  const base = { kind: 'WATCH' as const };
  switch (filter) {
    case 'active': return { ...base, status: 'active' };
    case 'followup': return { ...base, status: 'matched', contactedAt: null };
    case 'contacted': return { ...base, contactedAt: { not: null } };
    case 'closed': return { ...base, status: 'closed' };
    default: return base;
  }
}

export default async function WatchersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? '') ? (sp.status as Filter) : 'all';

  const [rows, total, activeCount, followupCount, contactedCount, closedCount] = await Promise.all([
    prisma.rationingFollow.findMany({
      where: whereFor(filter),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { phone: true } },
        city: { select: { name: true, nameEn: true } },
        sheet: { select: { id: true, applicantName: true, plotFullRef: true } },
      },
    }),
    prisma.rationingFollow.count({ where: { kind: 'WATCH' } }),
    prisma.rationingFollow.count({ where: { kind: 'WATCH', status: 'active' } }),
    prisma.rationingFollow.count({ where: { kind: 'WATCH', status: 'matched', contactedAt: null } }),
    prisma.rationingFollow.count({ where: { kind: 'WATCH', contactedAt: { not: null } } }),
    prisma.rationingFollow.count({ where: { kind: 'WATCH', status: 'closed' } }),
  ]);

  const counts: Record<Filter, number> = { all: total, active: activeCount, followup: followupCount, contacted: contactedCount, closed: closedCount };
  const label = (f: Filter) => (f === 'all' ? t('filterAll') : f === 'active' ? t('statusactive') : f === 'followup' ? t('followupTab') : f === 'contacted' ? t('contactedTab') : t('statusclosed'));

  const cityName = (c: { name: string; nameEn: string | null } | null) => (c ? L(c.name, c.nameEn || c.name) : '');
  const sheetLabel = (s: { applicantName: string; plotFullRef: string | null } | null) =>
    s ? `${s.applicantName}${s.plotFullRef ? ` · ${s.plotFullRef}` : ''}` : null;

  const followRows: FollowRow[] = rows.map((f) => ({
    id: f.id,
    name: f.applicantName,
    plot: f.plotNo ?? '',
    block: f.blockNo ?? '',
    city: cityName(f.city),
    phone: f.user?.phone ?? null,
    sheetId: f.sheet?.id ?? null,
    sheetLabel: sheetLabel(f.sheet),
    autoSms: f.lastNotifiedAt ? fmtDateTime(f.lastNotifiedAt, locale) : null,
    congrats: f.congratsAt ? fmtDateTime(f.congratsAt, locale) : null,
    contacted: f.contactedAt ? fmtDateTime(f.contactedAt, locale) : null,
    contactedBy: f.contactedBy ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {t('watchersTitle')} <span className="text-base font-normal opacity-60">({total})</span>
          </h1>
          <p className="text-sm opacity-70">{t('watchersHint')}</p>
        </div>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      {/* Follow-up queue call-out */}
      {followupCount > 0 && filter !== 'followup' && (
        <a href="/admin/rationing/watchers?status=followup" className="flex items-center justify-between gap-3 rounded-lg border-2 border-green/40 bg-green/5 p-4 hover:border-green">
          <span className="font-semibold text-primary">🔔 {t('followupCallout', { n: followupCount })}</span>
          <span className="text-sm font-semibold text-green">{t('followupOpen')} →</span>
        </a>
      )}

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
            {label(f)} <span className="opacity-60">({counts[f]})</span>
          </a>
        ))}
      </div>

      {filter === 'followup' || filter === 'contacted' ? (
        <FollowupTable rows={followRows} mode={filter} locale={locale} />
      ) : rows.length === 0 ? (
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
                  <td className="p-2">{cityName(f.city) || '—'}</td>
                  <td className="p-2" dir="ltr">{f.user?.phone ?? '—'}</td>
                  <td className="p-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[f.status] ?? ''}`}>
                      {f.contactedAt ? t('contactedTab') : t(`status${f.status}`)}
                    </span>
                  </td>
                  <td className="p-2">
                    {f.sheet ? (
                      <a href={`/rationing/${f.sheet.id}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{sheetLabel(f.sheet)}</a>
                    ) : '—'}
                  </td>
                  <td className="p-2" dir="ltr">{fmtDateTime(f.createdAt, locale)}</td>
                  <td className="p-2 text-end"><WatcherActions id={f.id} status={f.status} name={f.applicantName} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
