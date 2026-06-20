import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { LanguageSwitcher, ThemeToggle } from '@noc/ui';

export const dynamic = 'force-dynamic';

export default async function AppearancePage() {
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsAppearance')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <div className="space-y-4 rounded-lg border border-graphite/15 p-4">
        <p className="text-sm opacity-70">{t('appearanceHint')}</p>
        <div className="flex items-center gap-4">
          <span className="w-24 text-sm">{tc('language')}</span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-4">
          <span className="w-24 text-sm">{tc('appearance')}</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
