import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { SignOutButton } from '../_components/SignOutButton';

export default async function CustomerHome() {
  const session = await auth();
  if (!session?.user) redirect('/account/login');

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, createdAt: true },
  });

  const ta = await getTranslations('auth');
  const tc = await getTranslations('common');
  const tm = await getTranslations('mp');

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">{tc('portalName')}</h1>
        <SignOutButton />
      </div>
      <p className="text-sm opacity-80">
        {ta('loggedInAs')}:{' '}
        <strong dir="ltr">{dbUser?.phone ?? session.user.id}</strong>
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="/account/listings/new" className="rounded-md bg-primary px-4 py-2 text-sm text-soft">
          {tm('newOffer')}
        </a>
        <a href="/account/listings" className="rounded-md border border-graphite/25 px-4 py-2 text-sm">
          {tm('myOffers')}
        </a>
        <a href="/account/profile" className="rounded-md border border-graphite/25 px-4 py-2 text-sm">
          {ta('myProfile')}
        </a>
        <a href="/market" className="rounded-md border border-graphite/25 px-4 py-2 text-sm">
          {tm('title')}
        </a>
      </div>
      <a href="/" className="inline-block text-sm text-accent underline">
        {tc('backToSite')}
      </a>
    </main>
  );
}
