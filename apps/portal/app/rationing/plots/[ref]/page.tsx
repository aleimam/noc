import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../../../_components/SiteShell';
import { LimitCard } from '../../LimitCard';
import { RationingTabs } from '../../RationingTabs';
import { SearchBar } from '../../SearchBar';
import { getRationingConfig } from '../../../../lib/rationing/settings';
import { consumeRationingQuota } from '../../../../lib/rationing/quota';
import { getSiteConfig } from '../../../../lib/site';

// Single plot page — canonical URL /rationing/plots/<ref> (the old /rationing/plot?ref= 308s here).
export const dynamic = 'force-dynamic';

export default async function PlotDetail({ params }: { params: Promise<{ ref: string }> }) {
  const { ref: rawRef } = await params;
  let ref = '';
  try {
    ref = decodeURIComponent(rawRef).trim();
  } catch {
    notFound(); // malformed percent-encoding → unknown plot
  }
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('rationing');
  if (!ref) notFound();

  // A plot page lists every applicant on the plot — meter it against the same anti-scrape
  // quota as searches/record views so the register can't be enumerated plot by plot.
  const quota = await consumeRationingQuota(true);
  if (!quota.ok) {
    const site = await getSiteConfig();
    return (
      <SiteShell active="rationing">
        <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
          <Link href="/rationing/plots" className="inline-block text-sm text-navy-600">‹ {t('tabPlots')}</Link>
          <LimitCard locale={locale} loggedIn={quota.loggedIn} whatsapp={site.whatsappHelp} />
        </div>
      </SiteShell>
    );
  }

  const [sheets, config, cities] = await Promise.all([
    prisma.rationingSheet.findMany({
      where: { plotFullRef: ref },
      orderBy: { applicantName: 'asc' },
      take: 1000,
      include: { city: { select: { name: true } } },
    }),
    getRationingConfig(),
    prisma.rationingCity.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
  ]);
  if (sheets.length === 0) notFound();
  const first = sheets[0]!;

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <RationingTabs active="plots" showDashboard={config.showDashboard} />
        <SearchBar cities={cities} dymGloballyEnabled={config.didYouMeanEnabled} dymOptOut={false} />

        <Link href="/rationing/plots" className="inline-block text-sm text-navy-600">‹ {t('tabPlots')}</Link>

        <div className="rounded-2xl bg-navy-800 p-5 text-white">
          <div className="font-num text-2xl font-extrabold">{ref}</div>
          <div className="mt-1 text-navy-200">
            {first.city?.name ?? ''}
            {first.originalOwner ? ` · ${t('ownerLabelShort')} ${first.originalOwner}` : ''}
            {` · ${t('colApplicantsCount')}: `}<span className="font-num">{sheets.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {sheets.map((s) => (
            <Link
              key={s.id}
              href={`/rationing/${s.id}`}
              className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-gold hover:shadow-md"
            >
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-navy-50 text-navy-600" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xl font-bold text-navy-800">{s.applicantName}</div>
              </div>
              <span className="flex-none text-2xl text-gold" aria-hidden>‹</span>
            </Link>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
