// IndexNow instant indexing (Bing / Yandex / Seznam share the endpoint): POST freshly
// published URLs so crawlers pick them up in minutes instead of days.
// Protocol: https://www.indexnow.org/documentation
// - Ownership proof: each host serves the key at /indexnow-key.txt (route in BOTH apps).
// - The key lives in Setting('indexnow_key'), generated lazily on the first ping and
//   shared by both sites (one key may serve many hosts per the spec).
// - Fire-and-forget by design: `void pingIndexNow([...])` from server actions — it never
//   throws, warns on failure, and no-ops outside production.
import { randomUUID } from 'node:crypto';
import { prisma } from '@noc/db';
import { slugify } from './listings';

export const INDEXNOW_SETTING_KEY = 'indexnow_key';

export function portalOrigin(): string {
  return (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
}

export function brokerageOrigin(): string {
  return (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
}

/** The shared IndexNow key — generated once (32 hex chars) and persisted in Setting. */
async function getIndexNowKey(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: INDEXNOW_SETTING_KEY } });
  if (row?.value) return row.value;
  const value = randomUUID().replace(/-/g, ''); // 32 lowercase hex chars
  // Create-only upsert: if a concurrent request already generated a key, keep theirs.
  await prisma.setting.upsert({ where: { key: INDEXNOW_SETTING_KEY }, update: {}, create: { key: INDEXNOW_SETTING_KEY, value } });
  const persisted = await prisma.setting.findUnique({ where: { key: INDEXNOW_SETTING_KEY } });
  return persisted?.value || value;
}

/** Submit absolute URLs to IndexNow — grouped per host (the protocol takes one host per
 *  submission). Never throws; skips silently outside production. */
export async function pingIndexNow(urls: string[]): Promise<void> {
  try {
    if (process.env.NODE_ENV !== 'production') return;
    const unique = [...new Set(urls.filter(Boolean))];
    if (!unique.length) return;
    const byHost = new Map<string, string[]>();
    for (const u of unique) {
      try {
        const host = new URL(u).host;
        byHost.set(host, [...(byHost.get(host) ?? []), u]);
      } catch {
        console.warn('indexnow: skipping invalid URL', u);
      }
    }
    if (!byHost.size) return;
    const key = await getIndexNowKey();
    await Promise.all(
      [...byHost.entries()].map(async ([host, urlList]) => {
        const res = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host, key, keyLocation: `https://${host}/indexnow-key.txt`, urlList }),
        });
        if (!res.ok) console.warn(`indexnow: ${host} responded ${res.status}`);
      }),
    );
  } catch (e) {
    console.warn('indexnow ping failed', e);
  }
}

/** Al Sawarey canonical listing path — mirrors apps/brokerage/lib/listings.ts listingHref
 *  (same slugify; kept in sync — the brokerage detail page 308-canonicalizes if they drift). */
export function brokerageListingPath(l: { id: string; adNumber: string | null; typeEn: string | null; area: number | null }): string {
  if (!l.adNumber) return `/listings/${l.id}`;
  const slug = slugify([l.typeEn || 'land', l.area ? `${l.area}m` : ''].filter(Boolean).join(' ')) || 'land';
  return `/listings/${slug}-${l.adNumber}`;
}
