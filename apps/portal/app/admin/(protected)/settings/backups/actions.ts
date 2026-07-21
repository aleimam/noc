'use server';

import { writeFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { isValidEmail, isValidPhone } from '@noc/config';
import { APP_DIR, BACKUP_ROOT, BACKUP_ENV, listBackupFiles } from './backups';

const pexec = promisify(execFile);
type R = { ok: true; log?: string } | { ok: false; error: string };

const tail = (s: string, n = 24) => s.replace(/\s+$/, '').split('\n').slice(-n).join('\n');

/** Run one of our ops/*.sh scripts and return a trimmed log tail. Fixed argv (no shell) so
 *  nothing user-supplied is ever interpreted as a command. */
async function runScript(args: string[], timeoutMs: number): Promise<R> {
  try {
    const { stdout, stderr } = await pexec('bash', args, { cwd: APP_DIR, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, log: tail(`${stdout}${stderr}`) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, error: tail(`${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}`) || 'failed' };
  }
}

export async function runBackupNow(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const r = await runScript([`${APP_DIR}/ops/backup.sh`], 300_000);
  revalidatePath('/admin/settings/backups');
  return r;
}

const clampHM = (h: number, m: number) => ({
  h: Math.min(23, Math.max(0, Math.floor(h) || 0)),
  m: Math.min(59, Math.max(0, Math.floor(m) || 0)),
});

/** LOCAL nightly-backup schedule (rewrites the noc-backup cron) + retention days (ops/backup.env).
 *  (Off-site scheduling now lives in the tiered module's own admin, not here.) */
export async function saveScheduleRetention(input: {
  localH: number; localM: number; retentionDays: number;
}): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const l = clampHM(input.localH, input.localM);
  const days = Math.min(365, Math.max(1, Math.floor(input.retentionDays) || 14));

  const cronFile =
    `# NOC nightly backup (managed by Settings → Backups)\n` +
    `SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n` +
    `${l.m} ${l.h} * * * root /usr/bin/env bash ${APP_DIR}/ops/backup.sh >> ${BACKUP_ROOT}/backup.log 2>&1\n`;

  // Retention: merge RETAIN_DAYS into backup.env, preserving any other overrides.
  let envTxt = '';
  try { envTxt = await readFile(BACKUP_ENV, 'utf8'); } catch { /* none yet */ }
  const kept = envTxt.split('\n').filter((line) => line.trim() !== '' && !/^\s*RETAIN_DAYS\s*=/.test(line) && !/^\s*#\s*NOC backup overrides/.test(line));
  const envOut = ['# NOC backup overrides — managed by Settings → Backups (also editable by hand).', ...kept, `RETAIN_DAYS=${days}`].join('\n') + '\n';

  try {
    await writeFile('/etc/cron.d/noc-backup', cronFile, { mode: 0o644 });
    await writeFile(BACKUP_ENV, envOut, { mode: 0o600 });
    await pexec('bash', ['-c', 'systemctl reload crond 2>/dev/null || systemctl restart crond 2>/dev/null || true'], { timeout: 10_000 }).catch(() => {});
    revalidatePath('/admin/settings/backups');
    return { ok: true };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}

/** Integrity check: gzip-test the newest DB dump + newest uploads archive (restore-critical). */
export async function verifyLatest(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const files = await listBackupFiles();
  const newest = (k: 'db' | 'uploads') => files.filter((f) => f.kind === k).sort((a, b) => b.mtime - a.mtime)[0];
  const targets = [newest('db'), newest('uploads')].filter((f): f is NonNullable<typeof f> => !!f);
  if (targets.length === 0) return { ok: false, error: 'no backups to verify' };

  const lines: string[] = [];
  let allOk = true;
  for (const f of targets) {
    const full = path.join(BACKUP_ROOT, f.kind, f.name);
    try {
      await pexec('gzip', ['-t', full], { timeout: 180_000 });
      lines.push(`OK    ${f.name}`);
    } catch {
      allOk = false;
      lines.push(`FAIL  ${f.name}  ← corrupt!`);
    }
  }
  return allOk ? { ok: true, log: lines.join('\n') } : { ok: false, error: lines.join('\n') };
}

export async function saveAlertConfig(input: { enabled: boolean; email: string; phone: string }): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const emails = input.email.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = emails.join(', '); // one or more recipients (comma-separated)
  const phone = input.phone.trim();
  if (input.enabled && emails.length === 0 && !phone) return { ok: false, error: 'need_email_or_phone' };
  for (const e of emails) if (!isValidEmail(e)) return { ok: false, error: 'invalid_email' };
  if (phone && !isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };
  const value = JSON.stringify({ enabled: input.enabled, email, phone });
  try {
    await prisma.setting.upsert({ where: { key: 'backup.alert' }, update: { value }, create: { key: 'backup.alert', value } });
    revalidatePath('/admin/settings/backups');
    return { ok: true };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}
