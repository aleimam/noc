'use server';

// Server actions for the TIERED off-site backup module (Hetzner Storage Box over SFTP).
// The older rsync off-site helpers live in ./actions.ts and are untouched — this file
// only adds the new DB-driven module alongside them.

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { encryptSecret } from '@noc/backup';
import { runAllTiersNow, runTier, testConnection } from '@noc/backup';

type R = { ok: true; message?: string } | { ok: false; error: string };

const revalidate = () => revalidatePath('/admin/settings/backups');

export type OffsiteConnInput = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  /** Empty means "keep the stored password" — the plaintext never round-trips to the client. */
  password: string;
  remotePath: string;
  notifyOnFailure: boolean;
};

/**
 * Save the connection. Every field falls back to the STORED value, never to a
 * constant — a stale browser tab posting an older payload must not silently
 * downgrade a working config (spec §10.4).
 */
export async function saveOffsiteConnection(input: Partial<OffsiteConnInput>): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  try {
    const cur = await prisma.backupConfig.findFirst({ where: { singleton: 'BACKUP' } });
    if (!cur) return { ok: false, error: 'missing_config_row' };

    const port = Number.isFinite(input.port) && input.port! > 0 ? Math.floor(input.port!) : cur.port;
    const data = {
      enabled: input.enabled ?? cur.enabled,
      host: input.host?.trim() || cur.host,
      port,
      username: input.username?.trim() || cur.username,
      remotePath: input.remotePath?.trim() || cur.remotePath,
      notifyOnFailure: input.notifyOnFailure ?? cur.notifyOnFailure,
      // Only overwrite the secret when a new one was actually typed.
      ...(input.password ? { passwordEnc: encryptSecret(input.password) } : {}),
    };
    await prisma.backupConfig.update({ where: { id: cur.id }, data });
    revalidate();
    return { ok: true };
  } catch (e) {
    console.error('saveOffsiteConnection failed', e);
    return { ok: false, error: 'failed' };
  }
}

export type TierInput = {
  key: string;
  enabled: boolean;
  frequency: string;
  everyN: number;
  hourUtc: number;
  weekday: number;
  dayOfMonth: number;
  contents: string;
  remotePath: string;
  keepLast: number;
};

/** Save the levels. Each keeps its OWN folder — two levels sharing one would make
 *  each prune the other's archives, so identical paths are rejected. */
export async function saveTiers(inputs: TierInput[]): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  try {
    const paths = inputs.map((t) => (t.remotePath || '').trim().replace(/\/+$/, ''));
    const dupe = paths.find((p, i) => p && paths.indexOf(p) !== i);
    if (dupe) return { ok: false, error: `duplicate_path:${dupe}` };

    for (const t of inputs) {
      const cur = await prisma.backupTier.findUnique({ where: { key: t.key } });
      if (!cur) continue;
      await prisma.backupTier.update({
        where: { key: t.key },
        data: {
          enabled: t.enabled ?? cur.enabled,
          frequency: t.frequency || cur.frequency,
          everyN: Number.isFinite(t.everyN) && t.everyN >= 1 ? Math.floor(t.everyN) : cur.everyN,
          hourUtc: Number.isFinite(t.hourUtc) ? Math.min(23, Math.max(0, Math.floor(t.hourUtc))) : cur.hourUtc,
          weekday: Number.isFinite(t.weekday) ? Math.min(6, Math.max(0, Math.floor(t.weekday))) : cur.weekday,
          dayOfMonth: Number.isFinite(t.dayOfMonth) ? Math.min(28, Math.max(1, Math.floor(t.dayOfMonth))) : cur.dayOfMonth,
          contents: t.contents === 'DB' || t.contents === 'FULL' ? t.contents : cur.contents,
          remotePath: t.remotePath?.trim() || cur.remotePath,
          // keepLast 0 legitimately means "keep all"; only a non-number falls back.
          keepLast: Number.isFinite(t.keepLast) && t.keepLast >= 0 ? Math.floor(t.keepLast) : cur.keepLast,
        },
      });
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    console.error('saveTiers failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function testOffsiteConnection(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const r = await testConnection();
  revalidate();
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
}

/** Run one level on demand — works even when the level is disabled for scheduling. */
export async function runTierNow(tierKey: string): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const r = await runTier(tierKey, 'MANUAL');
  revalidate();
  return r.ok ? { ok: true, message: `${r.fileName} (${(r.sizeBytes / 1048576).toFixed(1)} MB)` } : { ok: false, error: r.error };
}

/** "Backup now" — one archive per enabled level, proving every folder end to end. */
export async function runAllNow(): Promise<R> {
  await requirePermission('settings', 'UPDATE');
  const rows = await runAllTiersNow();
  revalidate();
  const failed = rows.filter((r) => r.status === 'FAILED');
  if (failed.length) return { ok: false, error: failed.map((f) => `${f.tier}: ${f.error ?? 'failed'}`).join(' · ') };
  return { ok: true, message: rows.map((r) => r.tier).join('، ') };
}
