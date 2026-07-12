'use client';

// Search Intelligence (Phase S2) — client-side, fire-and-forget beacons to the app's
// /api/search-event (same-origin relative URL works on BOTH sites). Used to attribute a
// search → the result the visitor opened (`select`) and → a contact/offer that followed
// (`convert`). A failed beacon must NEVER affect UX, so everything is wrapped/swallowed.

export type SearchSite = 'newobour' | 'alsawarey';

type SearchEventPayload =
  | { kind: 'select'; site: SearchSite; query: string; listingId: string }
  | { kind: 'convert'; site: SearchSite; listingId: string };

const ENDPOINT = '/api/search-event';

/** POST a search-event payload without blocking navigation. Prefers navigator.sendBeacon
 *  (survives the page unload that a card click triggers); falls back to keepalive fetch.
 *  text/plain keeps it a "simple" request (no CORS preflight), matching /api/collect. */
function beacon(payload: SearchEventPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'text/plain' },
    }).catch(() => {});
  } catch {
    /* fire-and-forget: analytics must never break the page */
  }
}

/** Record that `listingId` was opened from a results page for the search `query`. */
export function trackSelect(site: SearchSite, query: string, listingId: string): void {
  if (!query || !listingId) return;
  beacon({ kind: 'select', site, query, listingId });
}

/** Record that a contact/offer/lead happened on `listingId` — attributed by the server to
 *  the recent search that produced the click on this listing. Safe to call from any handler. */
export function trackConvert(site: SearchSite, listingId: string): void {
  if (!listingId) return;
  beacon({ kind: 'convert', site, listingId });
}
