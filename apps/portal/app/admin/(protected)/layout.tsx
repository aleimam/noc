import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth, hasPermission } from '@noc/auth';
import { AdminShell, type AdminNavItem } from '@noc/ui';
import { SignOutButton } from '../../_components/SignOutButton';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') redirect('/admin/login');
  const user = session.user;

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  // Permission-filtered navigation. The dashboard is always shown; gated links
  // appear only for staff who can view them (more added with later modules).
  const gated = [
    { href: '/admin/marketplace', label: t('marketplace'), section: 'marketplace', action: 'VIEW' },
    { href: '/admin/rationing', label: t('rationing'), section: 'sheets', action: 'VIEW' },
    { href: '/admin/lands', label: t('lands'), section: 'lands', action: 'VIEW' },
    { href: '/admin/lands/lands', label: t('landPlots'), section: 'lands', action: 'VIEW' },
    { href: '/admin/news', label: t('news'), section: 'news', action: 'VIEW' },
    { href: '/admin/guide', label: t('guide'), section: 'guide', action: 'VIEW' },
    { href: '/admin/settings', label: t('settings'), section: 'settings', action: 'VIEW' },
  ];
  const nav: AdminNavItem[] = [
    { href: '/admin', label: t('dashboard') },
    ...gated
      .filter((i) => hasPermission(user.perms, i.section, i.action))
      .map((i) => ({ href: i.href, label: i.label })),
  ];

  return (
    <AdminShell
      brand={tc('portalName')}
      userLabel={user.email ?? user.id}
      nav={nav}
      backToSiteLabel={tc('backToSite')}
      signOut={<SignOutButton />}
    >
      {children}
    </AdminShell>
  );
}
