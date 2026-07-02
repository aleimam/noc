import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') redirect('/account/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true },
  });

  const t = await getTranslations('profile');

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
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
    </div>
  );
}
