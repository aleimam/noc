import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { TrackEvent } from '@noc/ui';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { consumeRationingQuota } from '../../lib/rationing/quota';
import { SiteShell } from '../_components/SiteShell';
import { LimitCard } from './LimitCard';
import { SearchBar } from './SearchBar';
import { RegisterCards } from './RegisterCards';
import { RationingTabs } from './RationingTabs';
import { ListControls } from './ListControls';
import { FbNotice, HelpButton } from './Bits';
import { TotalsCard } from './TotalsCard';
import { searchSheets, type SearchField, type SheetCard, type SortKey } from '../../lib/rationing/search';
import { getRationingConfig } from '../../lib/rationing/settings';
import { getRationingTotals } from '../../lib/rationing/stats';
import { getSiteConfig } from '../../lib/site';
import { pageMeta } from '../../lib/seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Rationing lists search — New Obour' : 'البحث في كشوف التقنين — العبور الجديدة',
    description: locale === 'en' ? 'Search the New Obour City rationing (تقنين) lists by applicant name or plot and view official source sheets.' : 'ابحث في كشوف تقنين مدينة العبور الجديدة بالاسم أو القطعة واطّلع على الكشوف الرسمية.',
    path: '/rationing',
    locale,
  });
}

const PER_OPTIONS = [10, 25, 50];

function str(v: string | string[] | undefined): string {
  return (typeof v === 'string' ? v : '').trim();
}

export default async function RationingSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q);
  const field = (['all', 'name', 'owner', 'plot', 'block'].includes(str(sp.field)) ? str(sp.field) : 'all') as SearchField;
  const cityId = str(sp.city);
  const dymOptOut = str(sp.dym) === '0';
  const usedSuggestion = str(sp.sug) === '1';
  const page = Math.max(1, parseInt(str(sp.page) || '1', 10) || 1);
  const perRaw = PER_OPTIONS.includes(parseInt(str(sp.per), 10)) ? parseInt(str(sp.per), 10) : 10;
  const sort = (['name', 'plot', 'newest'].includes(str(sp.sort)) ? str(sp.sort) : 'name') as SortKey;

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('rationing');
  const [config, site] = await Promise.all([getRationingConfig(), getSiteConfig()]);

  const cities = await prisma.rationingCity.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });

  const searched = q.length > 0;
  // Require a full name (≥2 words) for name-based searches — cuts noise + scraping. Numeric
  // plot/block lookups are exempt. When short, we show a prompt instead of searching.
  const nameField = field === 'all' || field === 'name' || field === 'owner';
  const needFullName = searched && nameField && q.split(/\s+/).filter(Boolean).length < 2;
  // Meter a NEW search (page 1) against the anti-scrape quota (New Obour only) — paginating an
  // existing search is free. A human does a handful/hour; a scraper enumerating the register
  // does hundreds. Anonymous = per-browser (nob_v) + generous per-IP ceiling; logged-in gets a
  // much higher budget. Over budget → friendly limit card instead of results. See quota.ts.
  const quota = await consumeRationingQuota(searched && !needFullName && page <= 1);
  const per = Math.min(perRaw, quota.maxResults);
  const throttled = searched && !needFullName && !quota.ok;
  let results: SheetCard[] = [];
  let total = 0;
  let suggestions: { display: string; score: number }[] = [];

  if (searched && !throttled && !needFullName) {
    const out = await searchSheets({
      q,
      field,
      cityId: cityId || undefined,
      take: per,
      skip: (page - 1) * per,
      sort,
      withSuggestions: config.didYouMeanEnabled && !dymOptOut,
    });
    results = out.results;
    total = out.total;
    suggestions = out.suggestions;

    const session = await auth();
    await prisma.sheetSearchLog.create({
      data: { query: q, field, resultsCount: total, matched: total > 0, usedSuggestion, userId: session?.user?.id ?? null },
    });
  }

  const totals = searched ? null : await getRationingTotals();
  const heroTitle = config.text?.[locale]?.heroTitle || t('searchTitle');
  const heroSubtitle = config.text?.[locale]?.heroSubtitle || t('searchSubtitle');
  const totalPages = Math.ceil(total / per);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (field !== 'all') params.set('field', field);
    if (cityId) params.set('city', cityId);
    if (dymOptOut) params.set('dym', '0');
    if (per !== 10) params.set('per', String(per));
    if (sort !== 'name') params.set('sort', sort);
    params.set('page', String(p));
    return `/rationing?${params.toString()}`;
  };

  return (
    <SiteShell active="rationing">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <FbNotice />

        <div className="pt-1 text-center">
          <h1 className="text-3xl font-black text-navy-800 sm:text-4xl dark:text-soft">{heroTitle}</h1>
          <p className="mt-2 text-lg text-ink-600">{heroSubtitle}</p>
        </div>

        <RationingTabs active="applicants" showDashboard={config.showDashboard} />

        {/* Sticky, oversized search */}
        <div className="sticky top-[72px] z-30 -mx-4 bg-soft px-4 py-2 dark:bg-navy-900">
          <SearchBar
            initialQ={q}
            initialField={field}
            initialCity={cityId}
            cities={cities}
            dymGloballyEnabled={config.didYouMeanEnabled}
            dymOptOut={dymOptOut}
          />
        </div>

        <details className="rounded-xl bg-white px-4 py-3 text-ink-700 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-navy-800 dark:text-soft">{t('howToSearch')}</summary>
          <p className="mt-2">{t('howToSearchBody')}</p>
        </details>

        {searched && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 px-1">
            <span className="rounded-full bg-gold-50 px-3.5 py-1.5 text-base font-medium text-gold-800">{t('didYouMean')}</span>
            {suggestions.map((s) => (
              <Link
                key={s.display}
                href={`/rationing?q=${encodeURIComponent(s.display)}${field !== 'all' ? `&field=${field}` : ''}&sug=1`}
                className="text-lg font-medium text-navy-600 underline decoration-gold/50 underline-offset-4 hover:text-navy-800"
              >
                {s.display}
              </Link>
            ))}
          </div>
        )}

        {throttled ? (
          <LimitCard locale={locale} loggedIn={quota.loggedIn} whatsapp={site.whatsappHelp} />
        ) : needFullName ? (
          <div className="rounded-2xl border-2 border-gold/60 bg-gold-50 p-5 text-center text-xl font-bold text-navy-800">{t('searchFullName')}</div>
        ) : searched ? (
          <>
            {page <= 1 && <TrackEvent type="search" label={q} value={total} />}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-base text-ink-500">
                {t('resultsN', { n: total })}
                {results.length > 0 && ` — ${t('clickToView')}`}
              </div>
              {results.length > 0 && (
                <ListControls
                  defaultSort="name"
                  sortOptions={[
                    { value: 'name', label: t('sortName') },
                    { value: 'plot', label: t('sortPlot') },
                    { value: 'newest', label: t('sortNewest') },
                  ]}
                />
              )}
            </div>

            <ResultsList rows={results} ownerLabel={t('ownerLabelShort')} />

            {total === 0 && (
              <div className="rounded-2xl border border-gold/40 bg-gold-50 p-5 text-center">
                <p className="text-xl font-bold text-navy-800">{t('noMatches')}</p>
                <p className="mt-1 text-ink-600">{t('noMatchesHint')}</p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('prev')}</Link>}
                <span className="text-ink-500">{t('pageOf', { page, total: totalPages })}</span>
                {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('next')}</Link>}
              </div>
            )}
          </>
        ) : (
          totals && <TotalsCard totals={totals} />
        )}

        <HelpButton number={site.whatsappHelp} />
        <RegisterCards q={q} />

        {/* Crowd-source missing sheets: visitors report sheets we haven't digitized yet.
            Placed below the follow-up cards — those come first in importance. */}
        <div className="rounded-2xl border-2 border-dashed border-navy-200 bg-white p-5 text-center">
          <p className="text-xl font-bold text-navy-800">{t('reportCardTitle')}</p>
          <p className="mt-1 text-ink-600">{t('reportCardBody')}</p>
          <Link href="/rationing/report" className="mt-3 inline-block rounded-xl bg-gold px-6 py-3 text-lg font-extrabold text-navy-900">
            📄 {t('reportMissedBtn')}
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}

function ResultsList({ rows, ownerLabel }: { rows: SheetCard[]; ownerLabel: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/rationing/${r.id}`}
          className="flex items-center gap-3.5 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-gold hover:shadow-md"
        >
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-navy-50 text-navy-600" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold text-navy-800 dark:text-soft">{r.applicantName}</div>
            <div className="mt-0.5 truncate text-sm text-ink-600">
              {r.originalOwner ? `${ownerLabel} ${r.originalOwner} · ` : ''}
              <span className="font-num">{r.plotFullRef || `${r.plotNo} / ${r.blockNo}`}</span>
              {r.cityName ? ` · ${r.cityName}` : ''}
            </div>
          </div>
          <span className="flex-none text-2xl text-gold" aria-hidden>‹</span>
        </Link>
      ))}
    </div>
  );
}
