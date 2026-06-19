import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { UploadDemo } from '../../../_components/UploadDemo';

export default async function AdminSettings() {
  // Redirects staff who lack `settings:view` (super-admin passes via wildcard).
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t('settings')}</h1>
      <p className="text-sm opacity-70">{t('settingsPlaceholder')}</p>
      <div className="rounded-lg border border-graphite/15 p-4">
        <UploadDemo />
      </div>
    </div>
  );
}
