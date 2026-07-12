'use client';

// Search Intelligence S3c — client submit for the zero-result lead form. Unlike the S2 beacons
// this one is AWAITED: the visitor sees a success/error state, so we use a normal same-origin JSON
// POST to the app's /api/search-lead (relative URL works on both sites).

export type SearchLeadSite = 'newobour' | 'alsawarey';
export type SearchLeadSurface = 'market' | 'storefront';

export type SearchLeadPayload = {
  site: SearchLeadSite;
  surface: SearchLeadSurface;
  query: string;
  phone: string;
  note?: string;
  name?: string;
  /** Honeypot — hidden field humans never fill; the server silently drops submissions that do. */
  website?: string;
};

export async function submitSearchLead(p: SearchLeadPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/search-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(p),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok && json?.ok ? { ok: true } : { ok: false, error: json?.error ?? 'failed' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
