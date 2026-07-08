import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function CustomerHome() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/account/login');

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, name: true, phoneVerifiedAt: true },
  });

  const t = await getTranslations('account');
  const tm = await getTranslations('mp');
  const tp = await getTranslations('profile');
  const verified = !!dbUser?.phoneVerifiedAt;

  const cards = [
    { href: '/account/follows', title: t('myFollows'), desc: t('goFollows') },
    { href: '/account/lands', title: t('myLands'), desc: t('goLands') },
    { href: '/account/listings', title: tm('myOffers'), desc: t('goListings') },
    { href: '/account/offers', title: tm('negoTitle'), desc: tm('negoManageDesc') },
    { href: '/account/wishlist', title: tm('wishlistTitle'), desc: tm('wishlistDesc') },
    { href: '/account/profile', title: tp('title'), desc: t('goProfile') },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-200 p-5">
        <h1 className="text-2xl font-black text-primary">
          {t('welcome')}{dbUser?.name ? `، ${dbUser.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {t('accountPhone')}: <strong dir="ltr">{dbUser?.phone ?? '—'}</strong>
        </p>
        <span
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${
            verified ? 'bg-green/15 text-green' : 'bg-gold/20 text-primary'
          }`}
        >
          {verified ? t('verifiedBadge') : t('unverifiedBadge')}
        </span>
      </div>

      {/* Plot consolidation & partnerships opt-in — aimed at small-plot owners. */}
      <Link
        href="/account/listings/new?partnership=1"
        className="block rounded-2xl border border-gold-300/60 bg-gold/10 p-5 transition-shadow hover:shadow-md"
      >
        <div className="text-lg font-bold text-primary">🤝 {tm('partnershipCardTitle')}</div>
        <p className="mt-1 text-sm text-ink-600">{tm('partnershipCardDesc')}</p>
        <span className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-bold text-soft">
          {tm('partnershipCardCta')}
        </span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-ink-200 p-5 transition-shadow hover:shadow-md"
          >
            <div className="text-lg font-bold text-primary">{c.title}</div>
            <p className="mt-1 text-sm text-ink-600">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
