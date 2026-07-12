import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth, hasPermission } from '@noc/auth';
import { AdminShell, type AdminNavGroup } from '@noc/ui'; // Toaster now mounts once in the root layout
import { SignOutButton } from '../../_components/SignOutButton';
import { AdminLightGuard } from '../../_components/AdminLightGuard';
import { AdminSearch } from '../../_components/AdminSearch';
import { adminSearch } from './search-actions';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.type !== 'STAFF') redirect('/admin/login');
  const user = session.user;

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);

  // Grouped, permission-filtered navigation. Items with no `section` are always shown;
  // empty groups are dropped. URLs are unchanged — only grouping + permission keys evolve.
  type NavItem = { href: string; label: string; section?: string };
  // 7 approved groups (2026-07 RBAC restructure): dashboard/analytics · New Obour ·
  // Al Sawarey · shared market (manage) · shared market (setup) · appearance · system.
  const groups: { title?: string; items: NavItem[] }[] = [
    { items: [{ href: '/admin', label: t('dashboard') }, { href: '/admin/analytics', label: L('تحليلات الزوّار', 'Visitor analytics'), section: 'analytics' }] },
    {
      title: L('العبور الجديد', 'New Obour'),
      items: [
        { href: '/admin/rationing', label: L('كشوف التقنين', 'Rationing sheets'), section: 'sheets' },
        { href: '/admin/lands', label: L('الدليل الجغرافي', 'Geo directory'), section: 'lands' },
        { href: '/admin/lands/lands', label: L('قطع الأراضي', 'Land plots'), section: 'lands' },
        { href: '/admin/newobour/market', label: L('سوق العبور — العروض', 'New Obour market'), section: 'listings' },
        { href: '/admin/marketplace/price-index', label: L('مؤشر الأسعار', 'Price index'), section: 'listings' },
        { href: '/admin/settings/calculator', label: L('حاسبة التصالح', 'Calculator'), section: 'settings' },
        { href: '/admin/news', label: L('الأخبار', 'News'), section: 'content' },
        { href: '/admin/guide', label: L('الدليل', 'Guide'), section: 'content' },
        { href: '/admin/guide/conditions', label: L('اشتراطات البناء', 'Building conditions'), section: 'content' },
      ],
    },
    {
      title: L('الصواري', 'Al Sawarey'),
      items: [
        { href: '/admin/marketplace', label: L('نظرة عامة على المتجر', 'Store overview'), section: 'storefront' },
        { href: '/admin/marketplace/offers', label: L('عروض البيع (الوارد)', 'Sell offers (inbox)'), section: 'listings' },
        { href: '/admin/marketplace/storefront', label: L('واجهة المتجر', 'Storefront'), section: 'storefront' },
        { href: '/admin/marketplace/sell-content', label: L('محتوى صفحة البيع', 'Sell-page content'), section: 'storefront' },
      ],
    },
    {
      title: L('السوق المشترك — الإدارة', 'Shared market — manage'),
      items: [
        { href: '/admin/marketplace/listings', label: L('الأراضي والعروض', 'Lands & listings'), section: 'listings' },
        { href: '/admin/marketplace/wishlists', label: L('قوائم المفضلة', 'Wishlists'), section: 'listings' },
        { href: '/admin/marketplace/owners', label: L('الملاك وجهات الاتصال', 'Owners & contacts'), section: 'owners' },
        { href: '/admin/marketplace/partner-applications', label: L('طلبات الشراكة', 'Partner applications'), section: 'owners' },
      ],
    },
    {
      title: L('السوق المشترك — الإعداد', 'Shared market — setup'),
      items: [
        { href: '/admin/marketplace/classifiers', label: L('التصنيفات', 'Classifiers'), section: 'catalog' },
        { href: '/admin/marketplace/attributes', label: L('التفاصيل', 'Details'), section: 'catalog' },
        { href: '/admin/marketplace/sections', label: L('مجموعات التفاصيل', 'Detail groups'), section: 'catalog' },
        { href: '/admin/marketplace/category-attributes', label: L('الفئات والتفاصيل', 'Categories & details'), section: 'catalog' },
        { href: '/admin/marketplace/option-lists', label: L('قوائم الاختيارات', 'Option lists'), section: 'catalog' },
        { href: '/admin/pages', label: L('الصفحات', 'Pages'), section: 'content' },
      ],
    },
    {
      title: L('المظهر والهوية', 'Appearance & identity'),
      items: [
        { href: '/admin/settings/branding', label: L('الشعارات والهوية', 'Branding'), section: 'appearance' },
        { href: '/admin/settings/theme', label: L('المظهر والألوان', 'Theme & colors'), section: 'appearance' },
        { href: '/admin/settings/watermark', label: L('العلامة المائية', 'Watermark'), section: 'appearance' },
        { href: '/admin/settings/poster-identity', label: L('هوية صور الإعلانات (البوستر)', 'Listing images (poster)'), section: 'appearance' },
        { href: '/admin/settings/appearance', label: L('لغة اللوحة', 'Panel language') },
      ],
    },
    {
      title: L('النظام والصلاحيات', 'System & access'),
      items: [
        { href: '/admin/settings/users', label: L('فريق العمل', 'Staff & roles'), section: 'staff' },
        { href: '/admin/settings/customers', label: L('العملاء', 'Customers'), section: 'customers' },
        { href: '/admin/settings/modules', label: L('الخدمات الظاهرة', 'Modules'), section: 'settings' },
        { href: '/admin/settings/apis', label: L('الرسائل والواجهات', 'SMS & APIs'), section: 'settings' },
        { href: '/admin/settings/security', label: L('الأمان', 'Security'), section: 'settings' },
        { href: '/admin/settings/analytics', label: L('التحليلات والتتبّع', 'Tracking config'), section: 'settings' },
        { href: '/admin/settings/site', label: L('إعدادات الموقع', 'Site settings'), section: 'settings' },
        { href: '/admin/settings/backups', label: L('النسخ الاحتياطية', 'Backups'), section: 'settings' },
        { href: '/admin/settings/account', label: L('حسابي', 'My account') },
      ],
    },
  ];

  const nav: AdminNavGroup[] = groups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => !i.section || hasPermission(user.perms, i.section, 'VIEW')) }))
    .filter((g) => g.items.length > 0);

  // Flattened, permission-filtered pages feed the global search's "modules" group.
  const searchPages = nav.flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href })));

  return (
    <AdminShell
      brand={tc('portalName')}
      userLabel={user.email ?? user.id}
      nav={nav}
      search={<AdminSearch pages={searchPages} action={adminSearch} />}
      backToSiteLabel={tc('backToSite')}
      storeLinks={[
        { label: L('العبور الجديد', 'New Obour'), href: process.env.PORTAL_URL || '/' },
        // Opens alsawarey.com in staff "admin view" (owner details) via a signed token.
        { label: L('الصواري (كمشرف)', 'Al Sawarey (as admin)'), href: '/admin/store-admin' },
      ]}
      signOut={<SignOutButton />}
    >
      <AdminLightGuard />
      {children}
    </AdminShell>
  );
}
