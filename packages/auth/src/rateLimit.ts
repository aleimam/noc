// Lightweight in-memory fixed-window rate limiter. Each app runs as a single process, so a
// module-level Map is a real limiter. Lives here (shared) so the partner-portal package and
// both apps can use one implementation; the per-app lib/rateLimit keeps clientIp for routes.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns true if allowed, false if the key exceeded `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
