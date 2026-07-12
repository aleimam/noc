'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { trackSelect, type SearchSite } from '../lib/searchEvent';

/**
 * Search Intelligence (Phase S2) — results→click attribution.
 *
 * Wraps a results grid and, via ONE delegated click listener, beacons a `select` event when
 * the visitor opens a listing card. The card link must carry `data-listing-id` (see
 * ListingCard / StoreLandCard). Scoped to its own subtree (display:contents so it adds no
 * box and preserves the grid's layout) so only real result cards count — not RecentlyViewed
 * or similar-listings cards elsewhere on the page.
 *
 * Renders children unchanged and never blocks navigation; only active when `query` is set.
 */
export function SearchSelectTracker({
  site,
  query,
  children,
}: {
  site: SearchSite;
  query: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const q = (query ?? '').trim();
    if (!root || !q) return;
    const onClick = (e: MouseEvent) => {
      const card = (e.target as Element | null)?.closest?.('[data-listing-id]') as HTMLElement | null;
      if (!card || !root.contains(card)) return;
      const listingId = card.getAttribute('data-listing-id');
      if (listingId) trackSelect(site, q, listingId);
    };
    // capture phase: fire before the browser starts the navigation the click triggers
    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }, [site, query]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
