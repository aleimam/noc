import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

function fmtDateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function SearchesPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';

  const logs = await prisma.sheetSearchLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { phone: true, name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('searchesTitle')} <span className="text-base font-normal opacity-60">({logs.length})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      {logs.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noSearches')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('query')}</th>
                <th className="p-2 text-start">{t('results')}</th>
                <th className="p-2 text-start">{t('matched')}</th>
                <th className="p-2 text-start">{t('phone')}</th>
                <th className="p-2 text-start">{t('when')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">{l.query}</td>
                  <td className="p-2">{l.resultsCount}</td>
                  <td className="p-2">{l.matched ? t('yes') : t('no')}</td>
                  <td className="p-2" dir="ltr">{l.user?.phone ?? l.phone ?? '—'}</td>
                  <td className="p-2" dir="ltr">{fmtDateTime(l.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
