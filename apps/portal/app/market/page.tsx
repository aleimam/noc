import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma, Prisma } from '@noc/db';
import { auth } from '@noc/auth';
import { newObourVisibility } from '@noc/partner-portal/visibility';
import { ListingCard, RecentlyViewed, TrackEvent, SearchSelectTracker, ZeroResultLead, SearchAutocomplete } from '@noc/ui';
import { SiteShell } from '../_components/SiteShell';
import { currency } from '@noc/i18n';
import { MarketFilters } from './MarketFilters';
import { MarketCardActions } from '../_components/MarketCardActions';
import { CompareBar } from '../_components/CompareBar';
import { wishedSet } from '../../lib/wishlist';
import { coversForListings } from '../../lib/listingCovers';
import { pageMeta } from '../../lib/seo';
import { SeoIntro } from '../_components/SeoText';
import { getSeoIntro } from '../../lib/seoContent';
import { partnershipsEnabled } from '../../lib/modules';
import { marketHref } from '../../lib/listings';
import { headers } from 'next/headers';
import { logSearch, normalizeSearch, expandSearchTerms } from '../../lib/search';
import { rateLimit, clientIp } from '../../lib/rateLimit';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Marketplace — New Obour' : 'سوق العبور — العبور الجديدة',
    description: locale === 'en' ? 'Lands and properties for sale in New Obour City — browse, filter and contact owners directly.' : 'أراضٍ وعقارات للبيع في مدينة العبور الجديدة — تصفّح وفلتر وتواصل مع الملاك مباشرة.',
    path: '/market',
    locale,
  });
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const q = get('q').trim();
  const partnershipsOn = await partnershipsEnabled();
  const intro = await getSeoIntro('market', locale);

  const typeCls = await prisma.classifier.findUnique({
    where: { key: 'type' },
    include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  const types = typeCls?.options ?? [];
  const typeKey = get('type');
  const selectedType = types.find((x) => x.key === typeKey) ?? null;

  const filterAttrs = selectedType
    ? await prisma.attribute.findMany({
        where: { isActive: true, filterable: true, classifierLinks: { some: { optionId: selectedType.id } } },
        orderBy: { order: 'asc' },
        include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      })
    : [];

  const and: Prisma.ListingWhereInput[] = [{ status: 'PUBLISHED' }, newObourVisibility()];
  if (selectedType) and.push({ typeOptionId: selectedType.id });
  // Plot consolidation & partnerships: "partnerships only" toggle (persistent URL param).
  if (partnershipsOn && get('partnership') === '1') and.push({ isPartnership: true });
  for (const a of filterAttrs) {
    if (a.type === 'NUMBER') {
      const numCond: Prisma.DecimalNullableFilter = {};
      const mn = get(`${a.key}_min`);
      const mx = get(`${a.key}_max`);
      if (mn) numCond.gte = Number(mn);
      if (mx) numCond.lte = Number(mx);
      if (mn || mx) and.push({ values: { some: { attributeId: a.id, number: numCond } } });
    } else if (a.type === 'BOOLEAN') {
      if (get(a.key) === '1') and.push({ values: { some: { attributeId: a.id, bool: true } } });
    } else {
      const keys = get(a.key) ? get(a.key).split(',') : [];
      if (keys.length) {
        const optIds = a.options.filter((o) => keys.includes(o.key)).map((o) => o.id);
        if (optIds.length) and.push({ values: { some: { attributeId: a.id, optionId: { in: optIds } } } });
      }
    }
  }

  // Free-text search is Arabic-normalized + multi-term (every term must appear in the
  // listing's haystack). We can't express that in Prisma, so with a query we pull a capped
  // candidate pool (facets/visibility still applied in SQL) and match in JS.
  // NOTE: fine at current inventory; if listings grow past a few thousand, move `normalized`
  // to a stored column + prefix index instead of scanning the pool in JS.
  const CANDIDATE_CAP = 500;
  const pool = await prisma.listing.findMany({
    where: { AND: and },
    orderBy: { publishedAt: 'desc' },
    take: q ? CANDIDATE_CAP : 60,
    include: {
      typeOption: true,
      neighborhood: { select: { nameAr: true, nameEn: true, district: { select: { nameAr: true, nameEn: true } } } },
    },
  });

  let listings = pool;
  if (q) {
    const terms = normalizeSearch(q).split(' ').filter(Boolean);
    // Expand each term to its synonym variants (admin dictionary) — term AND kept, variants OR'd.
    const expanded = await expandSearchTerms(terms, { site: 'newobour', surface: 'market' });
    const matched = pool.filter((l) => {
      const hay = normalizeSearch(
        [
          l.title,
          l.typeOption?.nameAr, l.typeOption?.nameEn,
          l.neighborhood?.district?.nameAr, l.neighborhood?.district?.nameEn,
          l.neighborhood?.nameAr, l.neighborhood?.nameEn,
          l.adNumber,
        ]
          .filter(Boolean)
          .join(' '),
      );
      return expanded.every((alts) => alts.some((v) => hay.includes(v)));
    });
    const userId = (await auth())?.user?.id ?? null;
    // Per-IP backstop on the log write: an unauth ?q= loop must not grow SearchLog unbounded
    // or poison trending. Over the cap the search still works — we just stop recording it.
    if (rateLimit(`slog:${clientIp(await headers())}`, 20, 60 * 1000)) {
      logSearch({ site: 'newobour', surface: 'market', query: q, resultsCount: matched.length, usedFastSearch: get('fast') === '1', userId });
    }
    listings = matched.slice(0, 60);
  }

  const ids = listings.map((l) => l.id);
  // Cover chain (location map → photo) — plot listings have maps, not photos.
  const cover = await coversForListings(ids);
  const wished = await wishedSet(ids);

  return (
    <SiteShell active="market">
      <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-extrabold text-navy-800">{t('title')}</h1>
      <SeoIntro text={intro} />

      {/* Instant search with autocomplete (S3): Arabic-normalized, multi-term, suggestion dropdown.
          Preserves the active type/partnership facets on navigate; picking a suggestion sets fast=1. */}
      <SearchAutocomplete
        action="/market"
        initialQuery={q}
        locale={locale}
        placeholder={L('ابحث بالعنوان أو المنطقة أو رقم الإعلان…', 'Search by title, area or ad number…')}
        extraParams={{ type: typeKey || '', partnership: partnershipsOn && get('partnership') === '1' ? '1' : '' }}
        inputClassName="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-lg text-navy-800 shadow-sm outline-none ring-1 ring-graphite/15 placeholder:text-ink-400"
      />

      <MarketFilters
        partnershipsEnabled={partnershipsOn}
        types={types.map((x) => ({ key: x.key, nameAr: x.nameAr, nameEn: x.nameEn }))}
        filterAttrs={filterAttrs.map((a) => ({
          id: a.id, key: a.key, labelAr: a.labelAr, labelEn: a.labelEn, type: a.type, unit: a.unit,
          options: a.options.map((o) => ({ key: o.key, labelAr: o.labelAr, labelEn: o.labelEn })),
        }))}
        typeKey={typeKey}
        locale={locale}
      />

      {Object.keys(sp).length > 0 && <TrackEvent type="market_search" label={typeKey || 'all'} value={listings.length} />}
      {listings.length === 0 && (
        <div className="mx-auto max-w-md space-y-4 py-10">
          <p className="text-center opacity-60">{t('noResults')}</p>
          {q && <ZeroResultLead site="newobour" surface="market" query={q} locale={locale} />}
        </div>
      )}
      {/* Wrap the results grid so a click on any card beacons a search `select` event (S2).
          The wrapper is inert (display:contents) unless a query is present. */}
      <SearchSelectTracker site="newobour" query={q}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listingId={l.id}
            href={marketHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null })}
            cover={cover.get(l.id) ?? null}
            title={l.title}
            subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
            price={l.price != null ? Number(l.price).toLocaleString('en-US') : null}
            currency={currency(locale)}
            badge={<MarketCardActions listingId={l.id} initialSaved={wished.has(l.id)} compareLabel={t('compare')} />}
            meta={l.isPartnership && partnershipsOn ? (
              <span className="inline-block rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-navy-800">🤝 {t('partnershipBadge')}</span>
            ) : undefined}
          />
        ))}
      </div>
      </SearchSelectTracker>
      <div className="mt-8"><RecentlyViewed title={t('recentlyViewed')} currency={currency(locale)} /></div>
      </div>
      <CompareBar labels={{ compare: t('compare'), clear: t('clear'), items: t('compareItems') }} />
    </SiteShell>
  );
}
