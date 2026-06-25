import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { PublicShell, ListingCard, Badge } from '@noc/ui';
import { currency } from '@noc/i18n';

export const dynamic = 'force-dynamic';

export default async function OwnerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const owner = await prisma.owner.findUnique({ where: { id } });
  if (!owner) notFound();

  const listings = await prisma.listing.findMany({
    where: { ownerId: id, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 60,
    include: { typeOption: true },
  });
  const ids = listings.map((l) => l.id);
  const covers = ids.length ? await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: ids }, attributeId: null }, orderBy: { createdAt: 'asc' }, select: { ownerId: true, path: true } }) : [];
  const cover = new Map<string, string>();
  for (const c of covers) if (c.ownerId && !cover.has(c.ownerId)) cover.set(c.ownerId, c.path);

  const typeLabel: Record<string, string> = { OWNER: t('typeOWNER'), COMPANY: t('typeCOMPANY'), BROKER: t('typeBROKER') };

  return (
    <PublicShell active="market">
      <div className="mx-auto max-w-[1120px] space-y-8 px-6 py-10">
        <div className="flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-6 shadow-sm">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-navy text-2xl font-black text-gold">{owner.name.slice(0, 1)}</div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy-800">{owner.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="gold" size="sm">{typeLabel[owner.type] ?? owner.type}</Badge>
              <span className="text-sm text-ink-500">{listings.length} {t('listings')}</span>
            </div>
          </div>
        </div>

        {listings.length === 0 ? (
          <p className="text-ink-500">{t('noResults')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                href={`/market/${l.id}`}
                cover={cover.get(l.id) ?? null}
                title={l.title}
                subtitle={L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
                price={l.price != null ? String(l.price) : null}
                currency={currency(locale)}
              />
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
