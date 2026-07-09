// In-memory login-attempt limiter (per identifier). After MAX_FAILS failed attempts in a
// rolling window the key is blocked for BLOCK_MS. Single-process (pm2) so a Map is enough;
// enforced inside each provider's authorize() and surfaced to the client via /api/login-status.

type Entry = { count: number; windowStart: number; blockedUntil: number };

const store = new Map<string, Entry>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

/** Namespaced, normalized key so staff/customer/partner counters never collide. */
export function loginKey(scope: string, id: string): string {
  return `${scope}:${id.trim().toLowerCase()}`;
}

/** Seconds until the key is allowed again (0 = not blocked). */
export function loginRetryAfter(key: string): number {
  const e = store.get(key);
  if (!e) return 0;
  const now = Date.now();
  return e.blockedUntil > now ? Math.ceil((e.blockedUntil - now) / 1000) : 0;
}

/** Record a failed attempt; blocks the key once it hits MAX_FAILS within the window. */
export function recordLoginFail(key: string): void {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now - e.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }
  e.count += 1;
  if (e.count >= MAX_FAILS) e.blockedUntil = now + BLOCK_MS;
}

/** Clear the counter on a successful sign-in. */
export function resetLogin(key: string): void {
  store.delete(key);
}

export const LOGIN_MAX_FAILS = MAX_FAILS;
