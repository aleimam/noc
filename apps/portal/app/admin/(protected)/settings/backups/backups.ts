// Server-only helpers for the Backups admin page. Reads the on-server backup tree
// (/root/backups) + the off-site config (ops/offsite.env), all guarded so a dev box
// without those paths just shows empty state. NEVER import this into a client component.
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const pexec = promisify(execFile);

export const APP_DIR = process.env.APP_DIR || '/root/noc';
export const BACKUP_ROOT = process.env.BACKUP_ROOT || '/root/backups';
export const OFFSITE_ENV = path.join(APP_DIR, 'ops', 'offsite.env');
const PUBKEY_PATH = '/root/.ssh/noc_backup.pub';

export type BackupKind = 'db' | 'uploads' | 'config';
export type BackupFile = { name: string; kind: BackupKind; size: number; mtime: number };
export type OffsiteConfig = { enabled: boolean; host: string; user: string; port: string; path: string; mirror: boolean };
export type BackupsSummary = {
  lastBackupAt: number | null;
  fileCount: number;
  totalSize: number;
  diskFree: number | null;
  offsiteLastLine: string;
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

async function tailFile(file: string, lines: number): Promise<string> {
  try {
    const txt = await readFile(file, 'utf8');
    return txt.replace(/\s+$/, '').split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

const PLACEHOLDERS = new Set(['backup.example.com', 'nocbackup', '/home/nocbackup/noc', '']);

export async function readOffsiteConfig(): Promise<OffsiteConfig> {
  try {
    const txt = await readFile(OFFSITE_ENV, 'utf8');
    const get = (k: string) => {
      const m = txt.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.*)$', 'm'));
      return m?.[1]?.trim() ?? '';
    };
    const clean = (v: string) => (PLACEHOLDERS.has(v) ? '' : v);
    const host = clean(get('OFFSITE_HOST'));
    return {
      enabled: host !== '' && get('OFFSITE_ENABLED') !== '0',
      host,
      user: clean(get('OFFSITE_USER')),
      port: get('OFFSITE_PORT') || '22',
      path: clean(get('OFFSITE_PATH')),
      mirror: get('OFFSITE_DELETE') !== '0',
    };
  } catch {
    return { enabled: false, host: '', user: '', port: '22', path: '', mirror: true };
  }
}

export async function readPubkey(): Promise<string> {
  return (await readFile(PUBKEY_PATH, 'utf8').catch(() => '')).trim();
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

  const offsiteLastLine = (await tailFile(path.join(BACKUP_ROOT, 'offsite.log'), 1)) || '';
  return { lastBackupAt, fileCount: files.length, totalSize, diskFree, offsiteLastLine };
}
