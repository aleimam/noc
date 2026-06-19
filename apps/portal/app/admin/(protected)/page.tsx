import { getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';

export default async function AdminDashboard() {
  const session = await auth();
  const user = session!.user;
  const t = await getTranslations('admin');
  const ta = await getTranslations('auth');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t('dashboard')}</h1>
      <p className="text-sm opacity-80">
        {ta('loggedInAs')}: <strong>{user.email}</strong> ({user.type})
      </p>
      <div className="rounded-lg border border-graphite/15 p-4">
        <h2 className="mb-1 font-semibold">{t('sections')}</h2>
        <p className="text-sm opacity-70">
          {user.perms.includes('*')
            ? 'SUPER_ADMIN — full access to all sections'
            : `${user.perms.length} permission(s) granted`}
        </p>
      </div>
    </div>
  );
}
