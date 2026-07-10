import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { listBackupFiles, readOffsiteConfig, readPubkey, backupsSummary, readRetentionDays, readSchedule, readAlertConfig } from './backups';
import { BackupsClient } from './BackupsClient';

export const dynamic = 'force-dynamic';

export default async function BackupsPage() {
  await requirePermission('settings', 'VIEW');
  const files = await listBackupFiles();
  const [offsite, pubkey, summary, retentionDays, schedule, alert] = await Promise.all([
    readOffsiteConfig(),
    readPubkey(),
    backupsSummary(files),
    readRetentionDays(),
    readSchedule(),
    readAlertConfig(),
  ]);
  const locale = (await getLocale()) as 'ar' | 'en';
  return (
    <BackupsClient
      locale={locale}
      files={files}
      offsite={offsite}
      pubkey={pubkey}
      summary={summary}
      retentionDays={retentionDays}
      schedule={schedule}
      alert={alert}
    />
  );
}
