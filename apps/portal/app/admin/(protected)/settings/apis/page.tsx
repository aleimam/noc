import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { SmsSettings } from '../SmsSettings';

export const dynamic = 'force-dynamic';

export default async function ApisSettings() {
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['sms_provider', 'sms_username', 'sms_sender', 'sms_environment'] } },
  });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsApis')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      {/* Password is never sent to the client; leaving it blank keeps the stored value. */}
      <SmsSettings
        initial={{
          provider: s.sms_provider ?? 'console',
          username: s.sms_username ?? '',
          password: '',
          sender: s.sms_sender ?? '',
          environment: s.sms_environment ?? '1',
        }}
      />
    </div>
  );
}
