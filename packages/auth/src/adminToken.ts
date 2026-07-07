import { createHmac, timingSafeEqual } from 'node:crypto';
import { appSecret } from './secret';

// Cross-app "view Al Sawarey as admin" token. Signed with AUTH_SECRET (shared by both apps)
// so the New Obour backend can mint a short-lived token that alsawarey.com trusts, without
// a shared session cookie. Payload = { uid, exp }; format = base64url(payload).hexHmac.
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function secret(): string {
  return appSecret();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Mint a signed admin-view token for a staff user id (default 8h validity). */
export function signAdminToken(uid: string, ttlMs = DEFAULT_TTL_MS): string {
  const payload = b64url(JSON.stringify({ uid, exp: Date.now() + ttlMs }));
  return `${payload}.${sign(payload)}`;
}

/** Verify a token; returns the staff user id if valid + unexpired, else null. */
export function verifyAdminToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}
