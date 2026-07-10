import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { listBackupFiles, readOffsiteConfig, readPubkey, backupsSummary } from './backups';
import { BackupsClient } from './BackupsClient';

export const dynamic = 'force-dynamic';

export default async function BackupsPage() {
  await requirePermission('settings', 'VIEW');
  const files = await listBackupFiles();
  const [offsite, pubkey, summary] = await Promise.all([readOffsiteConfig(), readPubkey(), backupsSummary(files)]);
  const locale = (await getLocale()) as 'ar' | 'en';
  return <BackupsClient locale={locale} files={files} offsite={offsite} pubkey={pubkey} summary={summary} />;
}
