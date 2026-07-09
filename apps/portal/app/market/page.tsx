import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma, Prisma } from '@noc/db';
import { ListingCard, RecentlyViewed } from '@noc/ui';
import { SiteShell } from '../_components/SiteShell';
import { currency } from '@noc/i18n';
import { MarketFilters } from './MarketFilters';
import { MarketCardActions } from '../_components/MarketCardActions';
import { CompareBar } from '../_components/CompareBar';
import { wishedSet } from '../../lib/wishlist';
import { pageMeta } from '../../lib/seo';
import { partnershipsEnabled } from '../../lib/modules';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Marketplace — New Obour' : 'سوق العبور — العبور الجديد',
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
  const partnershipsOn = await partnershipsEnabled();

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

  const and: Prisma.ListingWhereInput[] = [{ status: 'PUBLISHED' }];
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

  const listings = await prisma.listing.findMany({
    where: { AND: and },
    orderBy: { publishedAt: 'desc' },
    take: 60,
    include: { typeOption: true },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);
  const wished = await wishedSet(ids);

  return (
    <SiteShell active="market">
      <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-extrabold text-navy-800">{t('title')}</h1>

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

      {listings.length === 0 && <p className="py-12 text-center opacity-60">{t('noResults')}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            href={`/market/${l.id}`}
            cover={cover.get(l.id) ?? null}
            title={l.title}
            subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
            price={l.price != null ? Number(l.price).toLocaleString('en-US') : null}
            currency={currency(locale)}
            badge={<MarketCardActions listingId={l.id} initialSaved={wished.has(l.id)} compareLabel={t('compare')} />}
            meta={l.isPartnership && partnershipsOn ? (
              <span className="inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-navy-800">🤝 {t('partnershipBadge')}</span>
            ) : undefined}
          />
        ))}
      </div>
      <div className="mt-8"><RecentlyViewed title={t('recentlyViewed')} /></div>
      </div>
      <CompareBar labels={{ compare: t('compare'), clear: t('clear'), items: t('compareItems') }} />
    </SiteShell>
  );
}
