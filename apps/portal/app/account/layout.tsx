import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { AccountShell } from '../_components/AccountShell';

// The login page and any not-yet-authenticated view render bare (each protected page
// still redirects on its own); once a customer is signed in, wrap everything in the
// account chrome so all sections share one header + tab bar.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') return <>{children}</>;

  const t = await getTranslations('account');
  const tc = await getTranslations('common');
  const tm = await getTranslations('mp');
  const tp = await getTranslations('profile');

  const tabs = [
    { href: '/account', label: t('overview') },
    { href: '/account/follows', label: t('myFollows') },
    { href: '/account/lands', label: t('myLands') },
    { href: '/account/listings', label: tm('myOffers') },
    { href: '/account/profile', label: tp('title') },
  ];

  return (
    <AccountShell brand={tc('portalName')} backLabel={tc('backToSite')} tabs={tabs}>
      {children}
    </AccountShell>
  );
}
