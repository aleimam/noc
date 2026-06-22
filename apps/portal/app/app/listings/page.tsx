import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { MyListingActions } from './MyListingActions';

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: 'bg-green/15 text-green',
  PENDING: 'bg-gold/20 text-graphite',
  REJECTED: 'bg-red-100 text-red-700',
  SOLD: 'bg-navy/10 text-primary',
  DRAFT: 'bg-graphite/10 text-graphite',
  ARCHIVED: 'bg-graphite/10 text-graphite',
};

export default async function MyListings() {
  const session = await auth();
  if (!session?.user) redirect('/app/login');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const listings = await prisma.listing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { typeOption: { select: { nameAr: true, nameEn: true } } },
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
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('myOffers')}</h1>
        <div className="flex items-center gap-3">
          <a href="/app/listings/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('newOffer')}</a>
          <a href="/app" className="text-sm text-accent">← {t('cancel')}</a>
        </div>
      </div>

      {listings.length === 0 && <p className="py-10 text-center opacity-60">{t('noOffers')}</p>}

      <div className="space-y-3">
        {listings.map((l) => (
          <div key={l.id} className="flex items-center gap-4 rounded-lg border border-graphite/15 p-3">
            {cover.get(l.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.get(l.id)} alt="" className="h-16 w-16 rounded object-cover" />
            ) : (
              <div className="h-16 w-16 rounded bg-graphite/10" />
            )}
            <div className="flex-1 space-y-1">
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs opacity-70">
                {L(l.typeOption?.nameAr ?? '', l.typeOption?.nameEn ?? '')}
                {l.price != null ? ` · ${String(l.price)} ${currency(locale)}` : ''}
              </div>
              <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[l.status] ?? ''}`}>
                {t(`status${l.status}`)}
              </span>
              {l.status === 'REJECTED' && l.rejectionReason && (
                <p className="text-xs text-red-600">{l.rejectionReason}</p>
              )}
            </div>
            <MyListingActions id={l.id} status={l.status} />
          </div>
        ))}
      </div>
    </main>
  );
}
