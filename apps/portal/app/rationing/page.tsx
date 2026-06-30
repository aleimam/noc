import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { SiteShell } from '../_components/SiteShell';
import { SearchBar } from './SearchBar';
import { RegisterCards } from './RegisterCards';
import { RationingTabs } from './RationingTabs';
import { ListControls } from './ListControls';
import { searchSheets, browseSheets, type SearchField, type SheetCard, type SortKey } from '../../lib/rationing/search';
import { getRationingConfig } from '../../lib/rationing/settings';

export const dynamic = 'force-dynamic';

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
  const per = PER_OPTIONS.includes(parseInt(str(sp.per), 10)) ? parseInt(str(sp.per), 10) : 10;
  const sort = (['name', 'plot', 'newest'].includes(str(sp.sort)) ? str(sp.sort) : 'name') as SortKey;

  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('rationing');
  const config = await getRationingConfig();

  const cities = await prisma.rationingCity.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });

  const searched = q.length > 0;
  let results: SheetCard[] = [];
  let total = 0;
  let suggestions: { display: string; score: number }[] = [];

  if (searched) {
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
  } else if (config.showBrowseAll) {
    const out = await browseSheets({ cityId: cityId || undefined, take: per, skip: (page - 1) * per, sort });
    results = out.results;
    total = out.total;
  }

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
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="pt-2 text-center">
          <h1 className="text-3xl font-black text-navy-800 sm:text-4xl">{heroTitle}</h1>
          <p className="mt-2 text-lg text-ink-600">{heroSubtitle}</p>
        </div>

        <RationingTabs active="applicants" showDashboard={config.showDashboard} />

        <SearchBar
          initialQ={q}
          initialField={field}
          initialCity={cityId}
          cities={cities}
          dymGloballyEnabled={config.didYouMeanEnabled}
          dymOptOut={dymOptOut}
        />

        {searched && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 px-1">
            <span className="rounded-full bg-gold-50 px-3.5 py-1.5 text-sm font-medium text-gold-800">{t('didYouMean')}</span>
            {suggestions.map((s) => (
              <Link
                key={s.display}
                href={`/rationing?q=${encodeURIComponent(s.display)}${field !== 'all' ? `&field=${field}` : ''}&sug=1`}
                className="text-base font-medium text-navy-600 underline decoration-gold/50 underline-offset-4 hover:text-navy-800"
              >
                {s.display}
              </Link>
            ))}
          </div>
        )}

        {(searched || (config.showBrowseAll && results.length > 0)) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-500">
              {searched ? t('resultsN', { n: total }) : t('browsingN', { n: total })}
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
        )}

        <ResultsList rows={results} ownerLabel={t('ownerLabelShort')} />

        {searched && total === 0 && (
          <div className="rounded-2xl border border-gold/40 bg-gold-50 p-5 text-center">
            <p className="text-lg font-bold text-navy-800">{t('noMatches')}</p>
            <p className="mt-1 text-ink-600">{t('noMatchesHint')}</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('prev')}</Link>}
            <span className="text-ink-500">{t('pageOf', { page, total: totalPages })}</span>
            {page < totalPages && <Link href={pageHref(page + 1)} className="rounded-lg border border-ink-200 px-4 py-2 text-navy-700">{t('next')}</Link>}
          </div>
        )}

        <RegisterCards q={q} />
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
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-navy-50 text-xl text-navy-600" aria-hidden>
            ☻
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold text-navy-800">{r.applicantName}</div>
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
