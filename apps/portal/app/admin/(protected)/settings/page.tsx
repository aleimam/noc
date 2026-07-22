import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';

export const dynamic = 'force-dynamic';

export default async function SettingsHub() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  // System-only cards (2026-07 RBAC restructure): appearance and people pages have
  // their own sidebar groups now, so the hub keeps just the `settings`-gated surfaces.
  const cards = [
    { href: '/admin/settings/modules', label: L('الخدمات الظاهرة', 'Visible services'), desc: L('تفعيل/إخفاء خدمات العبور الجديدة', 'Turn New Obour services on or off') },
    { href: '/admin/settings/apis', label: t('settingsApis'), desc: t('settingsApisDesc') },
    { href: '/admin/settings/security', label: L('الأمان والحماية', 'Security & protection'), desc: L('مستوى حماية البيانات من النسخ', 'How strongly data is protected against scraping') },
    { href: '/admin/settings/analytics', label: L('التحليلات والتتبّع', 'Analytics & tracking'), desc: L('GA4 و Meta Pixel و Search Console', 'GA4, Meta Pixel and Search Console') },
    { href: '/admin/settings/site', label: L('إعدادات الموقع العامة', 'General site settings'), desc: L('قائمة الجوال، حقوق النشر، واتساب المساعدة', 'Mobile menu, copyright, help WhatsApp') },
    { href: '/admin/settings/backups', label: L('النسخ الاحتياطي', 'Backups'), desc: L('تحميل النسخ، نسخة فورية، ونسخة على خادم خارجي', 'Download backups, run one now, and copy off-server') },
    { href: '/admin/settings/account', label: t('settingsAccount'), desc: t('settingsAccountDesc') },
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
