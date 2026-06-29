import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/app/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true },
  });

  const t = await getTranslations('profile');

  return (
    <main className="mx-auto max-w-md space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <a href="/app" className="text-sm text-accent underline">
          {t('back')}
        </a>
      </div>
      <ProfileForm
        initialName={user?.name ?? ''}
        phone={user?.phone ?? ''}
        labels={{
          name: t('name'),
          namePlaceholder: t('namePlaceholder'),
          phone: t('phone'),
          phoneNote: t('phoneNote'),
          save: t('save'),
          saved: t('saved'),
          error: t('error'),
        }}
      />
    </main>
  );
}
