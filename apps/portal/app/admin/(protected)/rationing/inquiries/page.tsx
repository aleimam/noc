import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { InquiryActions } from '../SheetsClient';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-gold/20 text-graphite',
  MATCHED: 'bg-green/15 text-green',
  CLOSED: 'bg-graphite/10 opacity-70',
};

function fmtDateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function InquiriesPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';

  const inquiries = await prisma.inquiryRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { matchedSheet: { select: { applicantName: true, plotFullRef: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('inquiriesTitle')} <span className="text-base font-normal opacity-60">({inquiries.length})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      {inquiries.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noInquiries')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('kind')}</th>
                <th className="p-2 text-start">{t('status')}</th>
                <th className="p-2 text-start">{t('colOwner')}</th>
                <th className="p-2 text-start">{t('phone')}</th>
                <th className="p-2 text-start">{t('colCompany')}</th>
                <th className="p-2 text-start">{t('colPiece')}</th>
                <th className="p-2 text-start">{t('colLocation')}</th>
                <th className="p-2 text-start">{t('colMember')}</th>
                <th className="p-2 text-start">{t('matchedSheet')}</th>
                <th className="p-2 text-start">{t('when')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((q) => (
                <tr key={q.id} className="border-t border-graphite/10">
                  <td className="p-2">{t(`kind${q.kind}`)}</td>
                  <td className="p-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[q.status] ?? ''}`}>{t(`status${q.status}`)}</span>
                  </td>
                  <td className="p-2 font-medium">{q.ownerName}</td>
                  <td className="p-2" dir="ltr">{q.phone}</td>
                  <td className="p-2">{q.company ?? '—'}</td>
                  <td className="p-2">{q.originalPiece ?? '—'}</td>
                  <td className="p-2">{q.originalLocation ?? '—'}</td>
                  <td className="p-2">{q.originalMember ?? '—'}</td>
                  <td className="p-2">{q.matchedSheet ? `${q.matchedSheet.applicantName} · ${q.matchedSheet.plotFullRef ?? ''}` : '—'}</td>
                  <td className="p-2" dir="ltr">{fmtDateTime(q.createdAt, locale)}</td>
                  <td className="p-2 text-end">
                    <InquiryActions id={q.id} status={q.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
