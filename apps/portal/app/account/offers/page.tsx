import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { listBuyerNegotiations, listSellerNegotiations } from '@/lib/negotiation';
import { NegotiationThread } from '@/app/_components/NegotiationThread';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/account/login');
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');
  const [mine, incoming] = await Promise.all([
    listBuyerNegotiations(session.user.id),
    listSellerNegotiations(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-primary">{t('negoTitle')}</h1>

      <section className="space-y-3">
        <h2 className="font-bold text-navy-800 dark:text-soft">{t('negoIncoming')} <span className="opacity-60">({incoming.length})</span></h2>
        {incoming.length === 0 && <p className="text-sm text-ink-500">{t('negoNone')}</p>}
        {incoming.map((n) => (
          <div key={n.id} className="space-y-1.5">
            <div className="text-sm">
              <Link href={`/market/${n.listingId}`} className="font-bold text-navy-700 hover:underline dark:text-soft">{n.listingTitle}</Link>
              {(n.buyerName || n.buyerPhone) && <span className="ms-2 text-ink-600" dir="ltr">{n.buyerName ?? ''} {n.buyerPhone ?? ''}</span>}
            </div>
            <NegotiationThread role="seller" listingId={n.listingId} negotiation={{ id: n.id, status: n.status, offers: n.offers }} locale={locale} compact />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-navy-800 dark:text-soft">{t('negoMyOffers')} <span className="opacity-60">({mine.length})</span></h2>
        {mine.length === 0 && <p className="text-sm text-ink-500">{t('negoNone')}</p>}
        {mine.map((n) => (
          <div key={n.id} className="space-y-1.5">
            <div className="text-sm">
              <Link href={`/market/${n.listingId}`} className="font-bold text-navy-700 hover:underline dark:text-soft">{n.listingTitle}</Link>
              {n.contactPhone && <> · <a href={`tel:${n.contactPhone}`} dir="ltr" className="text-accent">{n.contactPhone}</a></>}
            </div>
            <NegotiationThread role="buyer" listingId={n.listingId} negotiation={{ id: n.id, status: n.status, offers: n.offers }} locale={locale} compact />
          </div>
        ))}
      </section>
    </div>
  );
}
