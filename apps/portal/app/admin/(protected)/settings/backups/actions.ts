'use server';

import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { APP_DIR, OFFSITE_ENV } from './backups';

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

export async function runOffsitePush(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const r = await runScript([`${APP_DIR}/ops/offsite-backup.sh`], 600_000);
  revalidatePath('/admin/settings/backups');
  return r;
}

export async function testOffsite(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  return runScript([`${APP_DIR}/ops/offsite-backup.sh`, '--test'], 45_000);
}

export type OffsiteInput = { enabled: boolean; host: string; user: string; port: string; path: string; mirror: boolean };

export async function saveOffsiteConfig(input: OffsiteInput): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const host = input.host.trim();
  const user = input.user.trim();
  const dest = input.path.trim();
  const port = String(Math.min(65535, Math.max(1, parseInt(input.port, 10) || 22)));

  // Validate to keep the env file well-formed and injection-free (no newlines/quotes/spaces).
  const okHost = /^[A-Za-z0-9.-]{1,253}$/.test(host);
  const okUser = /^[A-Za-z0-9._-]{1,64}$/.test(user);
  const okPath = /^\/[A-Za-z0-9._/-]{1,255}$/.test(dest);
  if (input.enabled) {
    if (!okHost) return { ok: false, error: 'invalid_host' };
    if (!okUser) return { ok: false, error: 'invalid_user' };
    if (!okPath) return { ok: false, error: 'invalid_path' };
  } else {
    if (host && !okHost) return { ok: false, error: 'invalid_host' };
    if (user && !okUser) return { ok: false, error: 'invalid_user' };
    if (dest && !okPath) return { ok: false, error: 'invalid_path' };
  }

  const content =
    [
      '# NOC off-site backup target — managed by Settings → Backups (also editable by hand).',
      `OFFSITE_ENABLED=${input.enabled ? 1 : 0}`,
      `OFFSITE_HOST=${host}`,
      `OFFSITE_USER=${user}`,
      `OFFSITE_PORT=${port}`,
      `OFFSITE_PATH=${dest}`,
      'OFFSITE_SSH_KEY=/root/.ssh/noc_backup',
      `OFFSITE_DELETE=${input.mirror ? 1 : 0}`,
    ].join('\n') + '\n';

  try {
    await writeFile(OFFSITE_ENV, content, { mode: 0o600 });
    revalidatePath('/admin/settings/backups');
    return { ok: true };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}
