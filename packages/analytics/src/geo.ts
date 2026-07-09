import geoip from 'geoip-lite';

/** Offline IP → geo (country / region / city) via the bundled GeoLite database.
 *  Returns nulls when the IP is private, unknown, or the lookup fails. */
export function lookupGeo(ip: string | null): { country: string | null; region: string | null; city: string | null } {
  const empty = { country: null, region: null, city: null };
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) return empty;
  try {
    const g = geoip.lookup(ip);
    if (!g) return empty;
    return { country: g.country || null, region: g.region || null, city: g.city || null };
  } catch {
    return empty;
  }
}
