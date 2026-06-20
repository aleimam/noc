import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { UploadDemo } from '../../../_components/UploadDemo';
import { SmsSettings } from './SmsSettings';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  // Redirects staff who lack `settings:view` (super-admin passes via wildcard).
  await requirePermission('settings', 'VIEW');
  const t = await getTranslations('admin');
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['sms_provider', 'sms_username', 'sms_sender', 'sms_environment'] } },
  });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">{t('settings')}</h1>
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
      <div className="rounded-lg border border-graphite/15 p-4">
        <UploadDemo />
      </div>
    </div>
  );
}
