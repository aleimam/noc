import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth, hasPermission } from '@noc/auth';
import { AdminShell, type AdminNavGroup } from '@noc/ui';
import { SignOutButton } from '../../_components/SignOutButton';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') redirect('/admin/login');
  const user = session.user;

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  // Grouped, permission-filtered navigation. Items with no `section` are always shown;
  // empty groups are dropped. All ALSWARY management lives in one group.
  type NavItem = { href: string; label: string; section?: string };
  const groups: { title?: string; items: NavItem[] }[] = [
    { items: [{ href: '/admin', label: t('dashboard') }] },
    {
      title: L('العبور الجديد', 'New Obour'),
      items: [
        { href: '/admin/rationing', label: t('rationing'), section: 'sheets' },
        { href: '/admin/lands', label: t('lands'), section: 'lands' },
        { href: '/admin/news', label: t('news'), section: 'news' },
        { href: '/admin/guide', label: t('guide'), section: 'guide' },
        { href: '/admin/pages', label: t('pages'), section: 'pages' },
      ],
    },
    {
      title: L('الصواري', 'ALSWARY'),
      items: [
        { href: '/admin/marketplace', label: L('نظرة عامة', 'Overview'), section: 'marketplace' },
        { href: '/admin/marketplace/listings', label: L('الأراضي والعروض', 'Lands & listings'), section: 'marketplace' },
        { href: '/admin/marketplace/offers', label: L('عروض البيع (الوارد)', 'Sell offers'), section: 'marketplace' },
        { href: '/admin/marketplace/owners', label: L('الملاك وجهات الاتصال', 'Owners & contacts'), section: 'marketplace' },
        { href: '/admin/marketplace/wishlists', label: L('قوائم المفضلة', 'Wishlists'), section: 'marketplace' },
        { href: '/admin/marketplace/storefront', label: L('واجهة المتجر', 'Storefront'), section: 'marketplace' },
        { href: '/admin/marketplace/sell-content', label: L('محتوى صفحة البيع', 'Sell-page content'), section: 'marketplace' },
        { href: '/admin/settings/watermark', label: L('العلامة المائية', 'Watermark'), section: 'marketplace' },
      ],
    },
    {
      title: L('الإعدادات', 'Settings'),
      items: [
        { href: '/admin/settings/users', label: L('المستخدمون', 'Users'), section: 'staff' },
        { href: '/admin/settings/customers', label: L('العملاء', 'Customers'), section: 'customers' },
        { href: '/admin/settings/branding', label: L('الشعارات والهوية', 'Branding'), section: 'settings' },
        { href: '/admin/settings/modules', label: L('الخدمات الظاهرة', 'Modules'), section: 'settings' },
        { href: '/admin/settings/analytics', label: L('التحليلات والتتبّع', 'Analytics'), section: 'settings' },
        { href: '/admin/settings/apis', label: L('الرسائل والواجهات', 'SMS & APIs'), section: 'settings' },
        { href: '/admin/settings/site', label: L('إعدادات الموقع العامة', 'Site settings'), section: 'settings' },
        { href: '/admin/settings/calculator', label: L('حساب التسوية', 'Settlement'), section: 'settings' },
        { href: '/admin/settings/appearance', label: L('المظهر', 'Appearance') },
        { href: '/admin/settings/account', label: L('حسابي', 'My account') },
      ],
    },
  ];

  const nav: AdminNavGroup[] = groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => !i.section || hasPermission(user.perms, i.section, 'VIEW')) }))
    .filter((g) => g.items.length > 0);

  return (
    <AdminShell
      brand={tc('portalName')}
      userLabel={user.email ?? user.id}
      nav={nav}
      backToSiteLabel={tc('backToSite')}
      storeLinks={[
        { label: 'العبور الجديد', href: process.env.PORTAL_URL || '/' },
        { label: 'الصواري', href: process.env.BROKERAGE_URL || 'https://alsawarey.com' },
      ]}
      signOut={<SignOutButton />}
    >
      {children}
    </AdminShell>
  );
}
