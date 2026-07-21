import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { listBackupFiles, backupsSummary, readRetentionDays, readSchedule, readAlertConfig } from './backups';
import { BackupsClient } from './BackupsClient';
import { OffsiteTiers } from './OffsiteTiers';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function BackupsPage() {
  // MANAGE, not VIEW — the page lists (and links downloads for) database/uploads archives.
  // Keep ordinary settings:VIEW limited to non-sensitive configuration.
  await requirePermission('settings', 'MANAGE');
  const files = await listBackupFiles();
  const [summary, retentionDays, schedule, alert] = await Promise.all([
    backupsSummary(files),
    readRetentionDays(),
    readSchedule(),
    readAlertConfig(),
  ]);
  const locale = (await getLocale()) as 'ar' | 'en';

  // Tiered off-site module (DB-driven). Sits alongside the local/rsync sections above.
  const [conn, tierRows, runRows] = await Promise.all([
    prisma.backupConfig.findFirst({ where: { singleton: 'BACKUP' } }),
    prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 15 }),
  ]);
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : null);
  // NOTE: passwordEnc is deliberately NOT projected — the secret never reaches the client.
  const connView = {
    enabled: conn?.enabled ?? false,
    host: conn?.host ?? '',
    port: conn?.port ?? 23,
    username: conn?.username ?? '',
    hasPassword: !!conn?.passwordEnc,
    remotePath: conn?.remotePath ?? '/home',
    notifyOnFailure: conn?.notifyOnFailure ?? true,
    lastTestAt: fmt(conn?.lastTestAt ?? null),
    lastTestOk: conn?.lastTestOk ?? null,
    lastTestMessage: conn?.lastTestMessage ?? null,
  };
  const tiers = tierRows.map((t) => ({
    key: t.key, label: t.label, enabled: t.enabled, frequency: t.frequency, everyN: t.everyN,
    hourUtc: t.hourUtc, weekday: t.weekday, dayOfMonth: t.dayOfMonth, contents: t.contents,
    remotePath: t.remotePath, keepLast: t.keepLast, lastRunAt: fmt(t.lastRunAt),
  }));
  const runs = runRows.map((r) => ({
    id: r.id, tierKey: r.tierKey, startedAt: fmt(r.startedAt)!, status: r.status, trigger: r.trigger,
    contents: r.contents, fileName: r.fileName,
    sizeMb: r.sizeBytes != null ? (Number(r.sizeBytes) / 1048576).toFixed(1) : null,
    error: r.error,
  }));

  return (
    <div className="space-y-6">
    <BackupsClient
      locale={locale}
      files={files}
      summary={summary}
      retentionDays={retentionDays}
      schedule={schedule}
      alert={alert}
    />
      <OffsiteTiers locale={locale} conn={connView} tiers={tiers} runs={runs} />
    </div>
  );
}
