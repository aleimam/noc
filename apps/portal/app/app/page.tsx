import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { SignOutButton } from '../_components/SignOutButton';

export default async function CustomerHome() {
  const session = await auth();
  if (!session?.user) redirect('/app/login');

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, createdAt: true },
  });

  const ta = await getTranslations('auth');
  const tc = await getTranslations('common');

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
      <a href="/" className="inline-block text-sm text-accent underline">
        {tc('backToSite')}
      </a>
    </main>
  );
}
