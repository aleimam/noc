/// <reference path="./ssh2-sftp-client.d.ts" />
import { createHash } from 'node:crypto';
// Remote transport. SFTP only — FTPS cannot work against a Hetzner Storage Box from
// a CSF-firewalled box (spec §8.2: IPv6 passive listener, TLS servername, and an
// ephemeral data port range that TCP_OUT will never allow). SFTP moves data over the
// single control connection, so it needs exactly ONE outbound port.

export type Transport = {
  /** The directory the login lands in — turns "permission denied" into advice. */
  homeDir: string | null;
  ensureDir(dir: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  upload(localPath: string, dir: string, fileName: string): Promise<void>;
  remove(dir: string, fileName: string): Promise<void>;
  /** Byte size of a remote file, for verifying an upload actually landed. */
  size(dir: string, fileName: string): Promise<number | null>;
  end(): Promise<void>;
};

export type RemoteConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};

/** Join remote path segments with forward slashes, collapsing duplicates. */
export function remoteJoin(...parts: string[]): string {
  return parts
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1');
}

/**
 * Reject anything that could escape the configured folder. Remote paths come from
 * admin input, so a traversal here would let a misconfiguration (or a hostile admin)
 * write or DELETE outside the backup tree.
 */
export function assertSafeRemotePath(p: string): string {
  const clean = remoteJoin(p);
  if (!clean.startsWith('/')) throw new Error(`Remote path must be absolute: "${p}"`);
  if (clean.split('/').includes('..')) throw new Error(`Remote path must not contain "..": "${p}"`);
  return clean;
}

/** File names we generate; never let one carry a separator into a remote call. */
export function assertSafeFileName(name: string): string {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`Unsafe remote file name: "${name}"`);
  }
  return name;
}

/**
 * Append the login directory and a worked example to a path/permission failure.
 * A bare "Bad path: /backup permission denied" tells the operator nothing.
 */
function explain(err: unknown, homeDir: string | null): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const pathy = /permission denied|no such file|bad path|failure/i.test(msg);
  if (pathy && homeDir) {
    return new Error(
      `${msg} — this account can only write inside "${homeDir}", so the remote folder must start ` +
        `with it (e.g. "${remoteJoin(homeDir, 'daily')}"). NOTE: a Storage Box sub-account sees its ` +
        `base directory as "/home", not as "/" and not as "/<app>".`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

// Pinned Storage Box SSH host-key fingerprints (OpenSSH SHA256 form, "SHA256:" prefix optional).
// Without this ssh2 accepts ANY host key, so a man-in-the-middle could receive the whole archive
// (DB dump + .env with AUTH_SECRET + DB creds) AND the login password. A key not in this set
// REFUSES the connection — the backup fails loudly instead of leaking. Rotate via
// BACKUP_SFTP_HOST_FP (comma-separated) if Hetzner ever changes its keys.
const PINNED_HOST_FPS: string[] = (
  process.env.BACKUP_SFTP_HOST_FP ||
  'SHA256:XqONwb1S0zuj5A1CDxpOSuD2hnAArV1A3wKY7Z3sdgM,SHA256:EMlfI8GsRIfpVkoW1H2u0zYVpFGKkIMKHFZIRkf2ioI'
)
  .split(',')
  .map((s) => s.trim().replace(/^SHA256:/i, ''))
  .filter(Boolean);

/** Connect over SFTP. Caller MUST call end() (use try/finally). */
export async function connectSftp(cfg: RemoteConfig): Promise<Transport> {
  // Dynamic import: ssh2 carries a native addon, so it must stay out of the
  // Next bundle (see serverExternalPackages) and load only when actually used.
  const { default: SftpClient } = await import('ssh2-sftp-client');
  const client = new SftpClient();

  // Host-key verification runs BEFORE auth, so a rejected key never sees the password either.
  let hostKeyMismatch: string | null = null;
  try {
    await client.connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
      readyTimeout: 20_000,
      hostVerifier: (key: Buffer) => {
        const fp = createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
        if (PINNED_HOST_FPS.includes(fp)) return true;
        hostKeyMismatch = fp;
        return false;
      },
    });
  } catch (e) {
    if (hostKeyMismatch) {
      throw new Error(
        `SFTP host-key verification FAILED for ${cfg.host}:${cfg.port}. The server presented ` +
          `SHA256:${hostKeyMismatch}, which is NOT in the pinned set — refusing to send the backup ` +
          `(possible man-in-the-middle, wrong host, or a Hetzner key rotation). If Hetzner rotated ` +
          `keys, set BACKUP_SFTP_HOST_FP to the new fingerprint(s) and redeploy.`,
      );
    }
    throw e;
  }

  let homeDir: string | null = null;
  try {
    homeDir = await client.cwd();
  } catch {
    homeDir = null; // not fatal — only used to improve error messages
  }

  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw explain(e, homeDir);
    }
  };

  return {
    homeDir,
    async ensureDir(dir) {
      const d = assertSafeRemotePath(dir);
      await wrap(async () => {
        if (!(await client.exists(d))) await client.mkdir(d, true);
      });
    },
    async list(dir) {
      const d = assertSafeRemotePath(dir);
      return wrap(async () => {
        if (!(await client.exists(d))) return [];
        const rows = await client.list(d);
        return rows.filter((r) => r.type === '-').map((r) => r.name);
      });
    },
    async upload(localPath, dir, fileName) {
      const d = assertSafeRemotePath(dir);
      const f = assertSafeFileName(fileName);
      await wrap(() => client.fastPut(localPath, remoteJoin(d, f)));
    },
    async remove(dir, fileName) {
      const d = assertSafeRemotePath(dir);
      const f = assertSafeFileName(fileName);
      await wrap(() => client.delete(remoteJoin(d, f)));
    },
    async size(dir, fileName) {
      const d = assertSafeRemotePath(dir);
      const f = assertSafeFileName(fileName);
      return wrap(async () => {
        const rows = await client.list(d);
        const hit = rows.find((r) => r.name === f);
        return hit ? hit.size : null;
      });
    },
    async end() {
      try {
        await client.end();
      } catch {
        /* closing a broken connection is not an error worth surfacing */
      }
    },
  };
}
