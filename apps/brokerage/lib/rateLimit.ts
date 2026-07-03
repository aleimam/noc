// Lightweight in-memory fixed-window rate limiter (F1). Each app runs as a single PM2
// process, so a module-level Map is a real limiter. The primary defence is still the edge
// (Cloudflare/Apache, see security.md §4.7); this is the inner backstop.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns true if allowed, false if the key has exceeded `limit` within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Opportunistic cleanup so the map can't grow unbounded.
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

/** Best-effort client IP behind Apache/Cloudflare. */
export function clientIp(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return h.get('x-real-ip') || 'unknown';
}
