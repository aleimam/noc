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
    { href: '/admin/settings/partners', label: t('settingsPartners'), desc: t('settingsPartnersDesc') },
    { href: '/admin/settings/apis', label: t('settingsApis'), desc: t('settingsApisDesc') },
    { href: '/admin/settings/appearance', label: t('settingsAppearance'), desc: t('settingsAppearanceDesc') },
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
