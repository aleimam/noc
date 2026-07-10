import type { Prisma } from '@noc/db';

/**
 * Listing visibility by partner site-access (Phase 4).
 *
 * A *partner* listing is one whose Owner has a partner login (`owner.portalUser`). Such listings
 * appear ONLY on the sites their Owner is enabled for (`siteNewObour` / `siteAlsawary`). Non-partner
 * listings (no owner, or a staff-managed owner with no login) are unaffected by partner site-access:
 *   - New Obour shows them always.
 *   - Al Sawarey keeps its existing per-listing `showOnBrokerage` toggle.
 *
 * Each helper returns a Prisma `Listing` where-fragment to AND into any public listing query.
 */

/** New Obour: everything EXCEPT partner listings whose partner isn't enabled for New Obour. */
export function newObourVisibility(): Prisma.ListingWhereInput {
  return { NOT: { owner: { portalUser: { isNot: null }, siteNewObour: false } } };
}

/**
 * Al Sawarey: partner listings need the partner enabled for Al Sawarey; non-partner listings keep
 * the per-listing `showOnBrokerage` toggle. (Replaces a bare `showOnBrokerage: true` gate.)
 */
export function alsawareyVisibility(): Prisma.ListingWhereInput {
  return {
    OR: [
      { owner: { portalUser: { isNot: null }, siteAlsawary: true } },
      { showOnBrokerage: true, NOT: { owner: { portalUser: { isNot: null } } } },
    ],
  };
}

/** In-memory equivalent of {@link newObourVisibility} for a listing whose owner+portalUser are loaded. */
export function listingVisibleOnNewObour(l: { owner?: { siteNewObour: boolean; portalUser?: unknown | null } | null }): boolean {
  const o = l.owner;
  return !(o && o.portalUser && !o.siteNewObour);
}
