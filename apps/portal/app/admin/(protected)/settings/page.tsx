import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';

export const dynamic = 'force-dynamic';

export default async function SettingsHub() {
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  const cards = [
    { href: '/admin/settings/account', label: t('settingsAccount'), desc: t('settingsAccountDesc') },
    { href: '/admin/settings/users', label: t('settingsUsers'), desc: t('settingsUsersDesc') },
    { href: '/admin/settings/customers', label: t('settingsCustomers'), desc: t('settingsCustomersDesc') },
    { href: '/admin/settings/apis', label: t('settingsApis'), desc: t('settingsApisDesc') },
    { href: '/admin/settings/security', label: 'الأمان والحماية', desc: 'مستوى حماية البيانات من النسخ' },
    { href: '/admin/settings/appearance', label: t('settingsAppearance'), desc: t('settingsAppearanceDesc') },
    { href: '/admin/settings/branding', label: 'الشعارات والهوية', desc: 'شعار وأيقونة كل موقع' },
    { href: '/admin/settings/poster-identity', label: 'هوية الصور المولّدة', desc: 'ألوان وخط وشعار البوستر والبطاقات لكل علامة' },
    { href: '/admin/settings/modules', label: 'الخدمات الظاهرة', desc: 'تفعيل/إخفاء خدمات العبور الجديد' },
    { href: '/admin/settings/calculator', label: 'حساب التسوية', desc: 'أرقام ونسب حساب المساحة والتسوية' },
    { href: '/admin/settings/site', label: 'إعدادات الموقع العامة', desc: 'قائمة الجوال، حقوق النشر، واتساب المساعدة' },
    { href: '/admin/settings/analytics', label: 'التحليلات والتتبّع', desc: 'GA4 و Meta Pixel و Search Console' },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t('settings')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="rounded-lg border border-graphite/15 p-5 transition-colors hover:border-accent">
            <div className="font-semibold text-primary">{c.label}</div>
            <div className="mt-1 text-sm opacity-70">{c.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
