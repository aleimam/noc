import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ImportSheets, DeleteBatchButton } from '../SheetsClient';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export default async function SheetsPage() {
  await requirePermission('sheets', 'VIEW');
  const t = await getTranslations('rationing');
  const locale = (await getLocale()) as 'ar' | 'en';

  const [total, batches, sheets] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.sheetImportBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.rationingSheet.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('sheets')} <span className="text-base font-normal opacity-60">({total})</span>
        </h1>
        <a href="/admin/rationing" className="text-sm text-accent">← {t('title')}</a>
      </div>

      <ImportSheets />

      {batches.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">{t('batches')}</h2>
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="p-2 text-start">{t('fileName')}</th>
                  <th className="p-2 text-start">{t('rows')}</th>
                  <th className="p-2 text-start">{t('uploadedAt')}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-graphite/10">
                    <td className="p-2">{b.fileName}</td>
                    <td className="p-2">{b.rowCount}</td>
                    <td className="p-2" dir="ltr">{fmtDate(b.createdAt, locale)}</td>
                    <td className="p-2 text-end">
                      <DeleteBatchButton id={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        {sheets.length === 0 ? (
          <p className="py-12 text-center opacity-60">{t('noSheets')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-graphite/15">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="p-2 text-start">{t('colNumber')}</th>
                  <th className="p-2 text-start">{t('colOwner')}</th>
                  <th className="p-2 text-start">{t('colCompany')}</th>
                  <th className="p-2 text-start">{t('colPiece')}</th>
                  <th className="p-2 text-start">{t('colLocation')}</th>
                  <th className="p-2 text-start">{t('colMember')}</th>
                  <th className="p-2 text-start">{t('colSheetDate')}</th>
                  <th className="p-2 text-start">{t('colPaymentDate')}</th>
                  <th className="p-2 text-start">{t('colNotes')}</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={s.id} className="border-t border-graphite/10">
                    <td className="p-2">{s.numberInSheet ?? '—'}</td>
                    <td className="p-2 font-medium">{s.ownerName}</td>
                    <td className="p-2">{s.company ?? '—'}</td>
                    <td className="p-2">{s.originalPiece ?? '—'}</td>
                    <td className="p-2">{s.originalLocation ?? '—'}</td>
                    <td className="p-2">{s.originalMember ?? '—'}</td>
                    <td className="p-2" dir="ltr">{fmtDate(s.sheetDate, locale)}</td>
                    <td className="p-2" dir="ltr">{fmtDate(s.paymentDate, locale)}</td>
                    <td className="max-w-[16rem] truncate p-2">{s.sheetNotes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
