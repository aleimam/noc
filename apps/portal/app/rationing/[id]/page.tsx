import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../_components/SiteShell';
import { LoginToView } from '../../_components/LoginToView';
import { LimitCard } from '../LimitCard';
import { getRationingConfig } from '../../../lib/rationing/settings';
import { consumeRationingQuota } from '../../../lib/rationing/quota';
import { getSiteConfig } from '../../../lib/site';
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

  // Opening a record counts toward the New Obour anti-scrape quota (search + views share the
  // hourly budget). Over budget → show the friendly limit card instead of the record. At HIGH
  // the source scan additionally requires login (break-glass).
  const quota = await consumeRationingQuota(true);
  const showScan = !quota.loginWall || quota.loggedIn;
  if (!quota.ok) {
    const site = await getSiteConfig();
    return (
      <SiteShell active="rationing">
        <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
          <Link href="/rationing" className="inline-block text-base text-navy-600">‹ {t('backToSearch')}</Link>
          <LimitCard locale={locale} loggedIn={quota.loggedIn} whatsapp={site.whatsappHelp} />
        </div>
      </SiteShell>
    );
  }

  // Number of applicants sharing the same original plot (for the plot link's CTA).
  const plotCount = sheet.plotFullRef
    ? await prisma.rationingSheet.count({ where: { plotFullRef: sheet.plotFullRef } })
    : 0;

  // Public fields only — remarks + sourceFile are internal and never rendered here.
  // "Attendance Day" (يوم الحضور) intentionally removed from the public detail (owner request).
  const facts: { label: string; value: string }[] = [
    { label: t('colOwner'), value: sheet.originalOwner ?? '—' },
    { label: t('colCity'), value: sheet.city?.name ?? '—' },
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
            <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl bg-gold text-2xl text-navy-900" aria-hidden>
              ✓
            </div>
            <div className="min-w-0">
              <div className="truncate text-2xl font-extrabold text-white">{sheet.applicantName}</div>
              <div className="font-num text-navy-200">{sheet.plotFullRef || `${sheet.plotNo} / ${sheet.blockNo}`}{sheet.city ? ` · ${sheet.city.name}` : ''}</div>
            </div>
          </div>

          <div className="p-5">
            {/* Original plot — emphasized + clickable → the plot page with all its applicants. */}
            {sheet.plotFullRef && (
              <Link
                href={`/rationing/plot?ref=${encodeURIComponent(sheet.plotFullRef)}`}
                className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 border-gold bg-gold/10 p-4 transition hover:bg-gold/20"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gold-700">{locale === 'ar' ? '📍 القطعة الأصلية' : '📍 Original plot'}</div>
                  <div className="mt-0.5 truncate font-num text-xl font-extrabold text-navy-800">{sheet.plotFullRef}</div>
                  {sheet.originalOwner && <div className="truncate text-sm text-ink-500">{t('colOwner')}: {sheet.originalOwner}</div>}
                </div>
                <span className="flex-none whitespace-nowrap text-sm font-bold text-gold-700">
                  {locale === 'ar' ? `كل المتقدمين (${plotCount}) ←` : `All ${plotCount} applicants ←`}
                </span>
              </Link>
            )}

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
                showScan ? (
                  <SourceSheetViewer src={scan.path} fileName={scan.fileName} watermark={scanWatermark} />
                ) : (
                  <LoginToView
                    next={`/rationing/${sheet.id}`}
                    title={locale === 'ar' ? 'صورة الكشف تتطلب تسجيل الدخول' : 'Sign in to view the sheet scan'}
                    note={
                      locale === 'ar'
                        ? 'سجّل الدخول برقم هاتفك لعرض صورة الكشف الأصلية.'
                        : 'Sign in with your phone number to view the original sheet scan.'
                    }
                    cta={locale === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
                  />
                )
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
