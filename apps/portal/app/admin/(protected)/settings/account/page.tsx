import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { AccountForm } from './AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') redirect('/admin/login');
  const t = await getTranslations('admin');
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsAccount')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <AccountForm initial={{ name: u?.name ?? '', email: u?.email ?? '' }} />
    </div>
  );
}
