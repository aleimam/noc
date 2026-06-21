import { getLocale, getTranslations } from 'next-intl/server';
import { prisma, Prisma } from '@noc/db';
import { ListingCard } from '@noc/ui';
import { currency } from '@noc/i18n';
import { MarketFilters } from './MarketFilters';

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

  const types = await prisma.propertyType.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
  const typeKey = get('type');
  const selectedType = types.find((x) => x.key === typeKey) ?? null;

  const filterAttrs = selectedType
    ? await prisma.attribute.findMany({
        where: { isActive: true, filterable: true, typeLinks: { some: { propertyTypeId: selectedType.id } } },
        orderBy: { order: 'asc' },
        include: { options: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      })
    : [];

  const and: Prisma.ListingWhereInput[] = [{ status: 'PUBLISHED' }];
  if (selectedType) and.push({ propertyTypeId: selectedType.id });
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
    include: { propertyType: true },
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

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <a href="/" className="text-sm text-accent">{t('cancel')}</a>
      </div>

      <MarketFilters
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
            subtitle={L(l.propertyType.nameAr, l.propertyType.nameEn)}
            price={l.price != null ? String(l.price) : null}
            currency={currency(locale)}
          />
        ))}
      </div>
    </main>
  );
}
