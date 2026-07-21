// Server-only helpers for the Backups admin page. Reads the on-server LOCAL backup tree
// (/root/backups), guarded so a dev box without those paths just shows empty state.
// NEVER import this into a client component.
//
// NOTE: the old rsync OFF-SITE piece was retired 2026-07-21 — off-site backups are now the
// tiered SFTP module (packages/backup + the OffsiteTiers admin section). Only the LOCAL nightly
// backup + its download/restore/alerts live here.
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { prisma } from '@noc/db';

const pexec = promisify(execFile);

export const APP_DIR = process.env.APP_DIR || '/root/noc';
export const BACKUP_ROOT = process.env.BACKUP_ROOT || '/root/backups';
export const BACKUP_ENV = path.join(APP_DIR, 'ops', 'backup.env');
export const DEFAULT_RETAIN_DAYS = 14;

export type BackupKind = 'db' | 'uploads' | 'config';
export type BackupFile = { name: string; kind: BackupKind; size: number; mtime: number };
export type BackupsSummary = {
  lastBackupAt: number | null;
  fileCount: number;
  totalSize: number;
  diskFree: number | null;
};

async function listDir(dir: string, kind: BackupKind): Promise<BackupFile[]> {
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names
        .filter((n) => !n.startsWith('.'))
        .map(async (name) => {
          const st = await stat(path.join(dir, name)).catch(() => null);
          return st?.isFile() ? { name, kind, size: st.size, mtime: Math.round(st.mtimeMs) } : null;
        }),
    );
    return files.filter((f): f is BackupFile => f !== null);
  } catch {
    return [];
  }
}

export async function listBackupFiles(): Promise<BackupFile[]> {
  const [db, up, cfg] = await Promise.all([
    listDir(path.join(BACKUP_ROOT, 'db'), 'db'),
    listDir(path.join(BACKUP_ROOT, 'uploads'), 'uploads'),
    listDir(path.join(BACKUP_ROOT, 'config'), 'config'),
  ]);
  return [...db, ...up, ...cfg].sort((a, b) => b.mtime - a.mtime);
}

export async function backupsSummary(files: BackupFile[]): Promise<BackupsSummary> {
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const lastBackupAt = files.length ? Math.max(...files.map((f) => f.mtime)) : null;

  let diskFree: number | null = null;
  try {
    const { stdout } = await pexec('df', ['-B1', '--output=avail', BACKUP_ROOT], { timeout: 8000 });
    const n = parseInt(stdout.trim().split('\n').pop() || '', 10);
    if (Number.isFinite(n)) diskFree = n;
  } catch {
    /* df missing (dev) — leave null */
  }

  return { lastBackupAt, fileCount: files.length, totalSize, diskFree };
}

/** RETAIN_DAYS from ops/backup.env (how many days of backups to keep); default 14. */
export async function readRetentionDays(): Promise<number> {
  try {
    const m = (await readFile(BACKUP_ENV, 'utf8')).match(/^\s*RETAIN_DAYS\s*=\s*(\d+)/m);
    const n = m ? parseInt(m[1]!, 10) : DEFAULT_RETAIN_DAYS;
    return n >= 1 && n <= 365 ? n : DEFAULT_RETAIN_DAYS;
  } catch {
    return DEFAULT_RETAIN_DAYS;
  }
}

export type Sched = { h: number; m: number };
export type Schedule = { local: Sched };

async function cronTime(file: string, def: Sched): Promise<Sched> {
  try {
    // matches the "MIN HOUR * * * root …" job line
    const m = (await readFile(file, 'utf8')).match(/^\s*(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*/m);
    if (!m) return def;
    return { m: parseInt(m[1]!, 10), h: parseInt(m[2]!, 10) };
  } catch {
    return def;
  }
}

export async function readSchedule(): Promise<Schedule> {
  const local = await cronTime('/etc/cron.d/noc-backup', { h: 2, m: 30 });
  return { local };
}

export type AlertConfig = { enabled: boolean; email: string; phone: string };

export async function readAlertConfig(): Promise<AlertConfig> {
  const row = await prisma.setting.findUnique({ where: { key: 'backup.alert' } }).catch(() => null);
  if (!row?.value) return { enabled: false, email: '', phone: '' };
  try {
    const j = JSON.parse(row.value);
    return { enabled: !!j.enabled, email: typeof j.email === 'string' ? j.email : '', phone: typeof j.phone === 'string' ? j.phone : '' };
  } catch {
    return { enabled: false, email: '', phone: '' };
  }
}
