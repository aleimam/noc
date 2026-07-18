import type { Prisma } from '@noc/db';

/**
 * Public listing visibility.
 *
 * **Owner decision 2026-07-18:** a partner's site-access flags (`siteNewObour` / `siteAlsawary`)
 * govern ONLY where that partner can *log in* — NOT where their listings appear. A partner's
 * listings show on BOTH public sites regardless of which site(s) they can access (editing from
 * either the partner portal or the admin changes the single shared Listing row, i.e. globally).
 * This replaces the old Phase-4 rule where partner listings were hidden from sites the partner
 * wasn't enabled for.
 *
 * So the only listing-level gates left are: soft-delete (`deletedAt`), status/type filters applied
 * by the caller, and — on Al Sawarey, for NON-partner listings only — the per-listing
 * `showOnBrokerage` toggle. Partner-owned listings always qualify for Al Sawarey (subject to the
 * caller's Type/Purpose `allowedOnAlsawarey` gates).
 *
 * Each helper returns a Prisma `Listing` where-fragment to AND into any public listing query.
 */

/** New Obour: every non-trashed listing (partner site-access no longer gates visibility). */
export function newObourVisibility(): Prisma.ListingWhereInput {
  return { deletedAt: null };
}

/**
 * Al Sawarey: partner-owned listings always qualify (shown on both sites); non-partner listings
 * keep the per-listing `showOnBrokerage` toggle.
 */
export function alsawareyVisibility(): Prisma.ListingWhereInput {
  return {
    deletedAt: null, // central soft-delete gate — trashed listings vanish from every public surface
    OR: [
      { owner: { portalUser: { isNot: null } } }, // any partner-owned listing → visible on both sites
      { showOnBrokerage: true }, // non-partner (or anyone) opted into the storefront
    ],
  };
}

/** In-memory equivalent of {@link newObourVisibility}: partner site-access no longer gates
 *  listing visibility, so every (non-trashed) listing is visible on New Obour. */
export function listingVisibleOnNewObour(_l?: unknown): boolean {
  return true;
}
