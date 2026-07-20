// Backup service: build the archive, push it off-site, prune, record the run.
//
// ⚠ This module must NOT import 'server-only'. It runs both inside Next (admin
// server actions) AND in the standalone tsx cron (ops/backup-tick.ts). 'server-only'
// is supplied by Next's bundler, so importing it here would make every SCHEDULED run
// fail with "Cannot find module 'server-only'" while manual runs kept working —
// exactly the failure the portable spec calls out (§10.3).

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { prisma } from '@noc/db';
import { archiveName, contentsLabel, isBackupDue, kindFor, planPrune, type Contents, type Schedule } from './logic';
import { decryptSecret } from './secret-box';
import { assertSafeRemotePath, connectSftp, type Transport } from './transport';

const execFileP = promisify(execFile);

/** Every archive we write is prefixed with this — the pruner matches on it, and it is
 *  the last line of defence if another app ever shares the folder (spec §2.2 rule 2). */
export const APP_PREFIX = 'noc';

const APP_DIR = process.env.APP_DIR || '/root/noc';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(APP_DIR, 'uploads');

export type RunTrigger = 'MANUAL' | 'SCHEDULED';
export type RunResult = { ok: true; fileName: string; sizeBytes: number } | { ok: false; error: string };

// ── connection ───────────────────────────────────────────────────────────────

async function loadConnection() {
  const cfg = await prisma.backupConfig.findFirst({ where: { singleton: 'BACKUP' } });
  if (!cfg) throw new Error('Backup config row missing — run the migration.');
  if (!cfg.host || !cfg.username) throw new Error('Off-site destination is not configured yet (host/username).');
  const password = decryptSecret(cfg.passwordEnc);
  // A null here means the stored secret cannot be read (AUTH_SECRET rotated or the
  // value is corrupt). Fail loudly — never fall through to a password-less connect.
  if (!password) {
    throw new Error(
      'Stored backup password could not be decrypted (was AUTH_SECRET rotated?). Re-enter it in Settings → Backups.',
    );
  }
  return { cfg, remote: { host: cfg.host, port: cfg.port, username: cfg.username, password } };
}

/** Connect, run `fn`, always disconnect. */
async function withTransport<T>(fn: (t: Transport, homeHint: string | null) => Promise<T>): Promise<T> {
  const { remote } = await loadConnection();
  const t = await connectSftp(remote);
  try {
    return await fn(t, t.homeDir);
  } finally {
    await t.end();
  }
}

/** Test the destination and remember the outcome for the admin UI. */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  let ok = false;
  let message = '';
  try {
    message = await withTransport(async (t) => {
      const cfg = await prisma.backupConfig.findFirst({ where: { singleton: 'BACKUP' } });
      const base = assertSafeRemotePath(cfg?.remotePath || '/home');
      await t.ensureDir(base);
      const items = await t.list(base);
      ok = true;
      return `تم الاتصال بنجاح. مجلد الدخول: ${t.homeDir ?? 'غير معروف'} · "${base}" يحتوي ${items.length} ملف.`;
    });
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  await prisma.backupConfig.updateMany({
    where: { singleton: 'BACKUP' },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 2000) },
  });
  return { ok, message };
}

// ── archive building ─────────────────────────────────────────────────────────

/** Parse DATABASE_URL the same way ops/backup.sh does. */
function dbCreds() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || '3306',
    name: u.pathname.replace(/^\//, ''),
  };
}

/**
 * Consistent MariaDB snapshot. `--single-transaction` gives a consistent read of
 * InnoDB tables without locking the live site. Credentials go in a temp defaults
 * file, never on argv (argv is world-readable via /proc).
 */
async function dumpDatabase(dest: string, stageDir: string): Promise<void> {
  const c = dbCreds();
  const cnf = path.join(stageDir, '.my.cnf');
  await writeFile(cnf, `[client]\nuser=${c.user}\npassword=${c.pass}\nhost=${c.host}\nport=${c.port}\n`, { mode: 0o600 });
  const bin = process.env.MYSQLDUMP_BIN || 'mariadb-dump';
  const args = [`--defaults-extra-file=${cnf}`, '--single-transaction', '--quick', '--routines', '--events', c.name];
  try {
    const { stdout } = await execFileP(bin, args, { maxBuffer: 1024 * 1024 * 512 });
    await writeFile(dest, stdout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ENOENT/.test(msg)) {
      // mariadb-dump is the MariaDB name; mysqldump is usually a symlink to it.
      const { stdout } = await execFileP('mysqldump', args, { maxBuffer: 1024 * 1024 * 512 });
      await writeFile(dest, stdout);
      return;
    }
    throw new Error(`database dump failed: ${msg.slice(0, 300)}`);
  } finally {
    await rm(cnf, { force: true });
  }
}

/** Stage the parts and produce a .tar.gz. Returns what the archive ACTUALLY holds. */
async function buildArchive(contents: Contents, at: Date): Promise<{ archivePath: string; tmpDir: string; fileName: string; actual: string }> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'noc-backup-'));
  const stage = path.join(tmpDir, 'stage');
  await mkdir(stage, { recursive: true });

  await dumpDatabase(path.join(stage, 'database.sql'), tmpDir);
  const entries = ['database.sql'];

  let hasUploads = false;
  if (contents === 'FULL') {
    try {
      await stat(UPLOADS_DIR);
      await cp(UPLOADS_DIR, path.join(stage, 'uploads'), { recursive: true });
      entries.push('uploads');
      hasUploads = true;
    } catch {
      // No uploads directory (e.g. a fresh box) — record the truth in the manifest
      // rather than claiming a FULL archive contains files it does not.
      hasUploads = false;
    }
  }

  // The manifest must describe what the archive ACTUALLY holds (spec §4).
  const actual = hasUploads ? 'db,uploads' : 'db';
  await writeFile(
    path.join(stage, 'manifest.json'),
    JSON.stringify({ app: APP_PREFIX, kind: kindFor(contents), createdAt: at.toISOString(), contents: actual }, null, 2),
  );
  entries.push('manifest.json');

  const fileName = archiveName(APP_PREFIX, kindFor(contents), at);
  const archivePath = path.join(tmpDir, fileName);
  const tar = await import('tar');
  await tar.create({ gzip: true, cwd: stage, file: archivePath }, entries);

  return { archivePath, tmpDir, fileName, actual };
}

// ── running a tier ───────────────────────────────────────────────────────────

type TierRow = {
  id: string; key: string; enabled: boolean; frequency: string; everyN: number; hourUtc: number;
  weekday: number; dayOfMonth: number; contents: string; remotePath: string; keepLast: number; lastRunAt: Date | null;
};

const scheduleOf = (t: TierRow): Schedule => ({
  frequency: t.frequency as Schedule['frequency'],
  everyN: t.everyN,
  hourUtc: t.hourUtc,
  weekday: t.weekday,
  dayOfMonth: t.dayOfMonth,
});

/**
 * Run ONE tier end to end: build → upload → verify size → prune → record.
 * Every branch cleans up its temp directory.
 */
export async function runTier(tierKey: string, trigger: RunTrigger): Promise<RunResult> {
  const tier = (await prisma.backupTier.findUnique({ where: { key: tierKey } })) as TierRow | null;
  if (!tier) return { ok: false, error: `Unknown backup level "${tierKey}".` };

  const startedAt = new Date();
  const run = await prisma.backupRun.create({
    data: { tierKey: tier.key, startedAt, status: 'RUNNING', trigger, contents: '' },
  });

  let tmpDir: string | null = null;
  try {
    const contents = (tier.contents === 'DB' ? 'DB' : 'FULL') as Contents;
    const built = await buildArchive(contents, startedAt);
    tmpDir = built.tmpDir;
    const localSize = (await stat(built.archivePath)).size;

    const dir = assertSafeRemotePath(tier.remotePath);
    await withTransport(async (t) => {
      await t.ensureDir(dir);
      await t.upload(built.archivePath, dir, built.fileName);

      // Do not trust a silent success — confirm the bytes actually landed.
      const remoteSize = await t.size(dir, built.fileName);
      if (remoteSize == null) throw new Error(`upload reported success but "${built.fileName}" is not in ${dir}`);
      if (remoteSize !== localSize) {
        throw new Error(`upload truncated: local ${localSize} bytes vs remote ${remoteSize} bytes`);
      }

      // Prune only AFTER a verified upload, so a failed run can never delete history.
      const names = await t.list(dir);
      const doomed = planPrune(APP_PREFIX, names, tier.keepLast);
      if (doomed.length) {
        console.log(`[backup] ${tier.key}: pruning ${doomed.length} in ${dir}: ${doomed.join(', ')}`);
        for (const name of doomed) await t.remove(dir, name);
      }
    });

    await prisma.$transaction([
      prisma.backupRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status: 'SUCCESS', contents: built.actual, fileName: built.fileName, sizeBytes: BigInt(localSize) },
      }),
      prisma.backupTier.update({ where: { id: tier.id }, data: { lastRunAt: startedAt } }),
      prisma.backupConfig.updateMany({ where: { singleton: 'BACKUP' }, data: { lastRunAt: startedAt } }),
    ]);
    return { ok: true, fileName: built.fileName, sizeBytes: localSize };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'FAILED', error: error.slice(0, 2000) },
    });
    // NOTE: lastRunAt is deliberately NOT stamped on failure — otherwise a broken
    // run would satisfy the schedule and the tier would silently skip its window.
    return { ok: false, error };
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * The scheduler tick. Loops EVERY tier and runs the due ones independently, so one
 * tier failing or being disabled never blocks the others.
 */
export async function runDueBackups(now = new Date()): Promise<{ ran: number; results: { tier: string; status: string }[] }> {
  const cfg = await prisma.backupConfig.findFirst({ where: { singleton: 'BACKUP' } });
  if (!cfg?.enabled) return { ran: 0, results: [] };

  const tiers = (await prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } })) as TierRow[];
  const results: { tier: string; status: string }[] = [];

  for (const tier of tiers) {
    if (!tier.enabled) continue; // `enabled` gates SCHEDULING only — "Run now" still works
    if (!isBackupDue(scheduleOf(tier), tier.lastRunAt, now)) continue;
    const r = await runTier(tier.key, 'SCHEDULED');
    results.push({ tier: tier.key, status: r.ok ? 'SUCCESS' : 'FAILED' });
  }
  return { ran: results.length, results };
}

/** "Backup now" — one archive per ENABLED tier, so a single click proves every
 *  folder and every contents choice end to end. */
export async function runAllTiersNow(): Promise<{ tier: string; status: string; error?: string }[]> {
  const tiers = (await prisma.backupTier.findMany({ orderBy: { sortOrder: 'asc' } })) as TierRow[];
  const out: { tier: string; status: string; error?: string }[] = [];
  for (const tier of tiers) {
    if (!tier.enabled) continue;
    const r = await runTier(tier.key, 'MANUAL');
    out.push({ tier: tier.key, status: r.ok ? 'SUCCESS' : 'FAILED', ...(r.ok ? {} : { error: r.error }) });
  }
  return out;
}
