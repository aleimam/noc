import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';
import { getRationingConfig } from '../../../lib/rationing/settings';
import { rationingScanOverlay } from '../../../lib/stamp';
import { SourceSheetViewer } from './SourceSheetViewer';
import { ShareButton } from './ShareButton';
import { SaveResultButton } from './SaveResultButton';
import { FbNotice } from '../Bits';
import { RegisterCards } from '../RegisterCards';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null, locale: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export default async function SheetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('rationing');
  const config = await getRationingConfig();
  // The system-wide 'rationing-scan' stamp category takes over when active; else legacy config.
  const scanWatermark = (await rationingScanOverlay()) ?? config.watermark;

  const sheet = await prisma.rationingSheet.findUnique({
    where: { id },
    include: { city: { select: { name: true } }, names: { orderBy: { isPrimary: 'desc' } } },
  });
  if (!sheet) notFound();

  const scan =
    config.showSourceSheets && sheet.sourceFile
      ? await prisma.rationingScan.findUnique({ where: { fileName: sheet.sourceFile }, select: { path: true, fileName: true } })
      : null;

  // Public fields only — remarks + sourceFile are internal and never rendered here.
  const facts: { label: string; value: string }[] = [
    { label: t('colOwner'), value: sheet.originalOwner ?? '—' },
    { label: t('colCity'), value: sheet.city?.name ?? '—' },
    { label: t('attendanceDay'), value: sheet.attendanceDay ?? '—' },
    { label: t('attendanceDate'), value: fmtDate(sheet.attendanceDate, locale) },
    { label: t('colListDate'), value: fmtDate(sheet.listDate, locale) },
    { label: t('declarationRequired'), value: sheet.declarationRequired ? t('yes') : t('no') },
  ];
  if (sheet.declarationRequired && sheet.declarationDetails) {
    facts.push({ label: t('declarationDetails'), value: sheet.declarationDetails });
  }

  const otherPeople = sheet.names.filter((n) => n.fullName !== sheet.applicantName);

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <Link href="/rationing" className="inline-block text-base text-navy-600">‹ {t('backToSearch')}</Link>
        <FbNotice />

        <div className="overflow-hidden rounded-2xl bg-white shadow-md">
          <div className="flex items-center gap-3.5 bg-navy-800 p-5">
            <div className="flex h-13 w-13 flex-none items-center justify-center rounded-xl bg-gold text-2xl text-navy-900" style={{ width: 52, height: 52 }} aria-hidden>
              ✓
            </div>
            <div className="min-w-0">
              <div className="truncate text-2xl font-extrabold text-white">{sheet.applicantName}</div>
              <div className="font-num text-navy-200">{sheet.plotFullRef || `${sheet.plotNo} / ${sheet.blockNo}`}{sheet.city ? ` · ${sheet.city.name}` : ''}</div>
            </div>
          </div>

          <div className="p-5">
            {otherPeople.length > 0 && (
              <div className="mb-4 rounded-xl bg-navy-50 p-3.5">
                <div className="text-sm font-semibold text-navy-700">{t('namesOnRecord')}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {sheet.names.map((n) => (
                    <span key={n.id} className="rounded-lg bg-white px-3 py-1 text-sm text-navy-800">{n.fullName}</span>
                  ))}
                </div>
              </div>
            )}

            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-sm text-ink-500">{f.label}</dt>
                  <dd className="text-lg font-medium text-navy-800">{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {scan ? (
                <SourceSheetViewer src={scan.path} fileName={scan.fileName} watermark={scanWatermark} />
              ) : config.showSourceSheets && sheet.sourceFile ? (
                <span className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-ink-400">
                  🖼 {t('viewSourceSoon')}
                </span>
              ) : null}
              <ShareButton text={`${sheet.applicantName} · ${sheet.plotFullRef ?? ''}`} />
              <SaveResultButton
                title={sheet.applicantName}
                subtitle={`${sheet.plotFullRef || `${sheet.plotNo} / ${sheet.blockNo}`}${sheet.city ? ` · ${sheet.city.name}` : ''}`}
                rows={facts}
                saveLabel={t('saveResult')}
                preparingLabel={t('preparing')}
              />
            </div>
          </div>
        </div>

        <RegisterCards q={sheet.applicantName} foundSheetId={sheet.id} />
      </div>
    </SiteShell>
  );
}
