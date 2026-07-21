# Codex Deep Audit Findings

**Passes 9–11 addendum:** Analytics/ops crons and backups, performance/schema, and the full security sweep are complete. Findings below are new to these passes and de-duplicated against Passes 1–8.

**Passes 5–8 addendum:** Rationing, geo/lands, search/public endpoints, and the media pipeline are complete. Findings below are new to these passes and de-duplicated against Passes 1–4.

**Pass 4 addendum:** Admin RBAC coverage is complete for every `/admin` route and every `apps/portal/app/admin/**/actions.ts`. Those findings remain in Section 1 and are de-duplicated against the earlier passes.

Audit status: **Passes 1–11 of 16 complete** — listings + EAV; soft delete + public visibility; partner portal auth, ownership/IDOR, lean form, listing save, and fast edit; admin RBAC; rationing; geo/lands; search/public endpoints; media pipeline; analytics/ops; performance/schema; security sweep. Passes 12–16 have not yet been performed. This report is intentionally cumulative; later focused passes should append, de-duplicate, and re-sort it.

## RESOLUTION — all 7 pass-1 defects FIXED, deployed and live-verified 2026-07-20

Every Pass-1 finding in the resolution table below was independently re-verified against the code
and against production data before being fixed. **A later pass must not re-report those seven resolved defects.** Commits `06e58e5` → `79c61dc`. The Pass-2 findings added to Section 1 are open.

| # | Defect | Fix | Verified by |
|---|---|---|---|
| P0 | Staff RBAC bypass + paper detach | staff writes to a listing they don't own require `listings:UPDATE`/`CREATE`; omitted paper fields mean "leave unchanged"; `ListingForm` sends papers only in `staffMode`; the account edit route is seller-only | all 6 live listings still hold both paper flags — no historical damage |
| P1 | Market SELECT filters ignore list items | filters OR over `listItemId` + `optionId`; chips read from the shared option list; same fix on the brokerage's 2 hard-coded facets | **was live breakage** — prod had 45 listItem values and 0 legacy, so every facet returned 0. Now each returns its exact DB count |
| P1 | Draft auto-save duplicate / silent demotion | submit stops new auto-saves, waits (bounded) for the in-flight one, then builds the payload; server does DRAFT lifecycle compare-and-set | reasoned + typechecked; not click-tested |
| P1 | EAV writes trust payload shape | `@noc/partner-portal/values` — `normalizeListingValues()` + `validateClassifierTrio()`, run BEFORE the required check | read-only prod replay: 6/6 listings round-trip with **zero** values dropped; `{SELECT, bool:false}`, foreign list item, and swapped type/purpose all rejected |
| P1 | Approve/reactivate skip required details | one shared gate (`@noc/partner-portal/required`) on **every** transition to PENDING/PUBLISHED; approve names the missing labels | prod replay: 0/6 blocked, empty-payload control returns exactly the 7 configured attributes |
| P1 | Archive toggle republishes REJECTED/SOLD/DRAFT | strictly PUBLISHED ↔ ARCHIVED, enforced server-side and hidden in the UI otherwise; `showOnBrokerage` no longer cleared | all 6 listings are PUBLISHED — nothing was wrongly republished |
| P1 | Price allows negative / zero inconsistent | `parsePriceInput()` + `isStoredPrice()` in `@noc/config` as the single rule, applied at every write and on the unguarded public surfaces | **was live** — newobour.com's home page rendered `0 ج.م`; now «السعر عند الطلب» |

**Additional defects found while verifying (not in the original report, all fixed):** the brokerage's
two hard-coded SELECT facets had the same `optionId`-only bug · `soldPrice` was normalized nowhere
(a partner entering 0 rendered `0 ج.م` on Al Sawarey) · a stale `soldPrice` survived leaving SOLD and
resurfaced as the next sale price · `/price-index` aggregated on `price != null`, so a 0 dragged the
public per-district median · the portal form sent SELECT ids as `listItemIds` even without a shared
list, which would hit the FK · price inputs had no `min` · **and the listing detail page's
meta/OG/twitter descriptions advertised `0 ج.م`** — the text Google indexes and WhatsApp shows.

**Section 2 (UI/UX enhancements) is also DONE** (`baf90b1`): auto-save failure now shows a red
«لم يتم الحفظ» panel with a Retry button and the last-saved time instead of silently reverting to
the idle hint; the moderation queue names each pending row's missing required details, links to its
edit page, and disables Approve while incomplete; the price field explains the blank/zero rule at
entry. Added beyond the report: `ListingCard` takes `priceOnRequest` and all six public grids pass
«السعر عند الطلب», so a price-less card states its meaning instead of leaving a blank space.

Baseline: both app typechecks pass after Pass 8 as well. `npm install` still cannot run because the machine's `npm.cmd` points to a missing roaming `npm-cli.js`; the existing `node_modules` was used to run TypeScript directly. No application source, environment file, database, upload, server, migration, or deployment was touched.

## Section 1 — Defects

### [P0] Any staff account can edit every listing outside RBAC, and that path can detach internal paper records
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/[id]/edit/page.tsx:16; apps/portal/app/account/listings/actions.ts:94; apps/portal/app/account/listings/actions.ts:231; apps/portal/app/account/listings/actions.ts:253; apps/portal/app/account/listings/actions.ts:308; apps/portal/app/account/listings/actions.ts:360
- What's wrong: The customer-account edit page admits every `STAFF` user regardless of `listings` permission, and `saveListing`/`setMyListingStatus` treat staff type as a global ownership bypass without calling `requirePermission`. That account loader also omits official-paper state; when a staff user saves through it, the staff-only branch interprets both paper flags as false and detaches the `ListingPaper` attachments.
- Failure scenario: A support-only staff user opens `/account/listings/<known-id>/edit`, changes any seller's listing, and saves. The write succeeds despite no listings grant, and an otherwise unrelated edit clears `hasAllocationLetter`/`hasSaleMandate` and releases their paper-photo rows.
- Suggested fix: Require the matching `listings` CREATE/UPDATE permission inside the action whenever `user.type === 'STAFF'`; make the account route seller-only, and move staff editing exclusively to the permission-gated admin route. Also make omitted staff-only paper fields mean “leave unchanged,” not false/clear.
- Blast radius: Every listing and every internal allocation-letter/sale-mandate attachment; all limited-role staff accounts.

### [P0] A partner can publish directly by forging a runtime status in the full account listing actions
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/actions.ts:55; apps/portal/app/account/listings/actions.ts:185; apps/portal/app/account/listings/actions.ts:255; apps/portal/app/account/listings/actions.ts:387; apps/portal/app/account/listings/actions.ts:412
- What's wrong: The server trusts TypeScript-only status unions. `saveListing` checks required details only when the runtime value equals `PENDING` and then writes any supplied value to Prisma; `setMyListingStatus` likewise performs no runtime allow-list check. A PARTNER session is explicitly supported by `saveListing`, even though the dedicated lean action correctly hard-codes `PENDING`.
- Failure scenario: A partner invokes the exposed account server action with `status: 'PUBLISHED'`. The save skips the PENDING completeness gate and stores a public status without staff approval; because partner-owned rows are globally visible by design, the listing can appear on New Obour and, when its Type/Purpose qualify, Al Sawarey immediately.
- Suggested fix: Runtime-parse every action payload. For all non-staff writers, derive status server-side and permit only DRAFT or PENDING; never accept PUBLISHED. Add a shared transition guard at the write boundary so every route to PENDING/PUBLISHED runs completeness and moderation policy.
- Blast radius: Every authenticated partner and customer seller; the public inventory and moderation queue on both brands.

### [P0] An original partner seller can reclaim and rewrite a listing after staff transfer it to another owner
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/page.tsx:25; apps/portal/app/account/listings/[id]/edit/page.tsx:14; apps/portal/app/account/listings/[id]/edit/page.tsx:19; apps/portal/app/account/listings/actions.ts:259; apps/portal/app/account/listings/actions.ts:266; apps/portal/app/account/listings/actions.ts:268; apps/portal/app/account/listings/actions.ts:394; apps/portal/app/account/listings/actions.ts:398
- What's wrong: Partner-created listings retain `sellerId = partner user id`. The legacy `/account/listings` pages and actions treat that seller id as sufficient forever, while the partner invariant requires current `ownerId` ownership. On save, the partner branch also overwrites `ownerId` with the session's owner, so a stale seller relationship becomes a transfer-back primitive.
- Failure scenario: Partner A creates a listing and staff later transfers it to Owner B. A still sees it under `/account/listings`, opens the seller-only edit route, and saves; authorization passes on `sellerId`, all content can be replaced, and ownership is silently moved back to A. A can also call `setMyListingStatus` against B's row.
- Suggested fix: For `user.type === 'PARTNER'`, authorize exclusively on `existing.ownerId === user.ownerId` in pages and actions; reserve `sellerId` ownership for CUSTOMER sellers. Redirect partner sessions away from the legacy account listing UI, and make owner transfer explicitly reconcile or clear stale partner seller provenance.
- Blast radius: Every listing created by a partner and later reassigned to a different owner; the receiving owner's data and inventory control.

### [P0] Disabling partner access does not reliably revoke it
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/auth/src/config.base.ts:35; packages/auth/src/config.base.ts:42; packages/auth/src/index.ts:88; packages/auth/src/index.ts:99; packages/auth/src/index.ts:116; packages/auth/src/index.ts:123; apps/portal/app/admin/(protected)/marketplace/actions.ts:246; apps/portal/app/admin/(protected)/marketplace/actions.ts:258; apps/portal/app/admin/(protected)/marketplace/actions.ts:287
- What's wrong: `isActive`, the current `ownerId`, and site-access flags are checked only during sign-in and then copied into a JWT; `requirePartner()` trusts that JWT without re-reading the user/owner. Separately, changing an owner to `US` hides the partner block but neither disables the existing User nor clears category grants, so even future sign-ins remain valid despite the code's “US owners never get partner access” rule.
- Failure scenario: Staff turn off “Login enabled” or revoke a site while a partner is signed in; that session continues browsing, changing account credentials, editing prices/statuses, and submitting listings until token expiry. If staff instead convert the owner to US, the active account can also sign in again because the login query never checks owner type.
- Suggested fix: Make `requirePartner()` re-query an active PARTNER linked to the token's owner and re-check `ownerAllowsSite(currentSite())`; invalidate sessions on sensitive account changes if possible. When converting to US, disable/delete the partner User and clear posting/browse grants transactionally.
- Blast radius: Every partner whose account/site access must be revoked, including urgent compromise and staff offboarding cases.

### [P0] A partner can transfer the account's OTP login to an unverified phone or email
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/actions.ts:11; packages/partner-portal/src/actions.ts:14; packages/partner-portal/src/actions.ts:19; packages/auth/src/otp.ts:113; packages/auth/src/index.ts:105
- What's wrong: `partnerUpdateAccount` writes a new phone/email immediately, without proving control of the destination, and allows the old identifiers to be cleared in the same request. Partner OTP login then trusts that new destination as the account's credential.
- Failure scenario: A logged-in partner changes the account phone to an unregistered victim's number (or email) and clears the old identifiers. The victim requests a partner code for their own number/address, receives the OTP, and signs into the partner account; a typo instead leaves an OTP-only account unreachable after sign-out.
- Suggested fix: Verify a new phone/email with a short-lived OTP before making it a login identifier; keep the old route until confirmation and require one verified route to remain. Apply the same verification policy to both self-service and admin-created identifier changes.
- Blast radius: Every partner account whose identifiers can be edited; account takeover and lockout.

### [P1] Buyers can open or continue negotiations on a trashed listing and trigger SMS notifications
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/offers/actions.ts:34; apps/portal/app/account/offers/actions.ts:65
- What's wrong: `makeOffer` accepts any row whose retained status is `PUBLISHED` and never checks `deletedAt`; soft deletion deliberately leaves status unchanged. `respondNegotiation` loads the listing through the negotiation relation without selecting or checking either visibility field, so a counteroffer can also reopen a thread after deletion.
- Failure scenario: Staff trash a published listing, then a buyer with its id submits or counters an offer. The action creates an offer, reopens the negotiation, and can SMS the seller even though the public listing is gone and only the admin trash is meant to see it.
- Suggested fix: Gate new offers and counter/accept operations on `listing: { deletedAt: null, status: 'PUBLISHED' }`; still allow a buyer to withdraw an existing thread if product policy requires cleanup.
- Blast radius: New Obour buyers and sellers with negotiations on any listing during its 90-day trash window; unnecessary SMS cost and misleading sales activity.

### [P1] Permanent deletion leaves internal official-paper attachment records orphaned
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/actions.ts:706; ops/purge-deleted-listings.ts:28; packages/db/prisma/schema.prisma:201; packages/db/prisma/schema.prisma:568
- What's wrong: Both mirrored purge transactions delete only attachment owner types `Listing` and `ListingPoster`, but official allocation-letter and sale-mandate photos use `ListingPaper`. `Attachment.ownerId` is polymorphic and has no listing foreign key, so deleting the `Listing` cannot cascade to those rows.
- Failure scenario: A trashed listing with either official paper is purged manually or by the 90-day cron. The listing disappears permanently, while its `ListingPaper` attachment row, public path, original path, and uploader link remain indefinitely with an owner id that can never resolve.
- Suggested fix: Add `ListingPaper` to the identical owner-type list in both purge transactions, and run a one-time orphan cleanup for existing paper rows whose owner listing no longer exists.
- Blast radius: Internal official-paper records and storage metadata for every paper-bearing listing ever hard-deleted; retention/privacy expectations and database hygiene.

### [P1] New Obour wishlists render soft-deleted listings and permit adding them by id
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/wishlist/page.tsx:20; apps/portal/app/account/wishlist/actions.ts:42; apps/portal/lib/listingCovers.ts:35
- What's wrong: The wishlist relation filters only `status: 'PUBLISHED'`; a soft-deleted listing retains that status and is included with its title, price, type, cover lookup, and dead public link. The toggle action also accepts an arbitrary existing listing id without a visibility check, so the defect is reachable even when the item was not saved before deletion.
- Failure scenario: A visitor saved a listing, staff trash it, and the visitor opens the wishlist. The card and its listing data still render, but its link 404s; a caller who knows the id can also add the trashed row back to a wishlist during retention.
- Suggested fix: Apply `newObourVisibility()` plus `status: 'PUBLISHED'` in the wishlist relation and validate the same predicate before creating a `WishlistItem` (while still allowing removal of an existing item).
- Blast radius: Anonymous and signed-in New Obour wishlist users during the 90-day trash window.

### [P1] A trashed New Obour listing still produces listing-specific SEO and social metadata
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/lib/listings.ts:22; apps/portal/app/market/[id]/page.tsx:32; apps/portal/app/market/[id]/page.tsx:110
- What's wrong: The public slug resolver looks up by id/ad number without status or soft-delete visibility, and `generateMetadata` then checks only `PUBLISHED`. The page body later rejects `listing.deletedAt`, but metadata has already been built from the trashed row's title, description, price, canonical path, and first photo.
- Failure scenario: Staff trash a formerly published listing and its known URL is requested or shared. The route body is a 404, yet the request resolves the deleted row and produces its former listing title/description/OG image instead of the generic not-found metadata.
- Suggested fix: Make `resolveMarketListingId` a public resolver by applying `status: 'PUBLISHED'` and `newObourVisibility()` there, or apply the same predicate inside `generateMetadata` before reading the cover.
- Blast radius: Deleted New Obour listings requested by crawlers, messaging preview bots, or visitors with old links until hard purge.

### [P1] Al Sawarey sitemap and inventory counts do not use the storefront's actual visibility rule
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/brokerage/app/sitemap.ts:10; apps/brokerage/app/page.tsx:46; apps/portal/app/admin/(protected)/page.tsx:46; apps/brokerage/lib/listings.ts:197; packages/partner-portal/src/visibility.ts:29
- What's wrong: The storefront catalogue uses status + Type/Purpose allow-lists + `alsawareyVisibility()` (partner-owned rows regardless of the per-listing toggle; non-partner rows require it). The sitemap and both public home counters instead hard-code `showOnBrokerage: true`, while the admin “On Al Sawarey” count uses only that toggle and not even status or `deletedAt`.
- Failure scenario: A partner-owned published listing with `showOnBrokerage = false` is visible in the live catalogue but absent from the sitemap and public inventory count. Conversely, a toggled row whose Type/Purpose was disallowed can be emitted in the sitemap even though its detail URL 404s, and a trashed/archived toggled row inflates the admin KPI.
- Suggested fix: Export one reusable Al Sawarey storefront predicate (including status when appropriate) and use it for catalogue reads, sitemap generation, public counts, and the admin KPI.
- Blast radius: Search indexing, Al Sawarey homepage trust stats, and staff inventory reporting for all partner or category-restricted listings.

### [P1] The mirrored “alive” endpoint retains listings that are no longer visible on either site
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/api/listings/alive/route.ts:24; apps/brokerage/app/api/listings/alive/route.ts:24; packages/ui/src/components/RecentlyViewed.tsx:44; apps/portal/app/market/[id]/page.tsx:110; apps/brokerage/lib/listings.ts:197
- What's wrong: Both routes define “alive” as non-deleted plus `PUBLISHED|SOLD`. New Obour serves only `PUBLISHED`, while Al Sawarey additionally requires its Type/Purpose and partner/toggle gates; `RecentlyViewed` trusts the endpoint and renders cached title, price, cover, and href snapshots for every returned id.
- Failure scenario: A New Obour listing becomes `SOLD`, or an Al Sawarey listing is hidden by its toggle/Type/Purpose. A successful alive check still approves the stored snapshot, so the “Recently viewed” row continues exposing a stale card that links to a 404 instead of pruning it.
- Suggested fix: Keep the route implementations mirrored, but branch through a shared site-aware visibility predicate keyed by trusted site identity: New Obour `PUBLISHED + newObourVisibility`, Al Sawarey its full storefront predicate.
- Blast radius: Visitors who previously opened a listing later hidden by a sale or storefront eligibility change; stale data persists per browser in local storage.

### [P1] Partner 30-day view analytics include views from trashed listings
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/Analytics.tsx:18; packages/partner-portal/src/Analytics.tsx:27; packages/db/prisma/schema.prisma:713
- What's wrong: The per-listing analytics query correctly excludes `deletedAt != null`, but the adjacent 30-day `ListingViewDay.groupBy` relation filters only `ownerId`. Daily rows cascade only on hard deletion, so the trend and “Views (30 days)” total retain a trashed listing's views throughout the retention period while every other portfolio KPI omits it.
- Failure scenario: A partner listing receives views this month and staff trash it. The listing vanishes from the performance table and all-time total, but its recent views remain in the chart and 30-day total, producing mutually inconsistent analytics.
- Suggested fix: Add `deletedAt: null` to the groupBy relation predicate: `listing: { ownerId, deletedAt: null }`.
- Blast radius: Partner analytics on both domains for owners whose listings are trashed within the 30-day reporting window.

### [P1] Soft-deleted listings reappear in ordinary admin queues, owner views, counts, and wishlist rankings
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/page.tsx:55; apps/portal/app/admin/(protected)/marketplace/owners/personal/page.tsx:15; apps/portal/app/admin/(protected)/marketplace/owners/[id]/page.tsx:20; apps/portal/app/admin/(protected)/marketplace/wishlists/page.tsx:15; apps/portal/app/admin/(protected)/marketplace/wishlists/page.tsx:19
- What's wrong: The main dashboard's recent-pending query, owner listing relation/count, and wishlist top-listing aggregation/title lookup omit `deletedAt: null`. These are normal admin surfaces, while the documented sole exception is the dedicated trash page.
- Failure scenario: Staff trash a pending, owner-linked, or heavily wishlisted listing. It can remain in the dashboard queue, inflate an owner's listing count and render on the owner detail page, or consume a top-wishlist rank; its links then lead to the edit route's 404 because that route correctly refuses trash.
- Suggested fix: Add `deletedAt: null` to the dashboard query, filtered owner relation/count, wishlist groupBy relation predicate, and title lookup; keep `deletedAt: { not: null }` isolated to the trash page.
- Blast radius: Staff moderation and reporting accuracy; every owner/listing with a retained soft-deleted row.

### [P1] Draft auto-save can create a duplicate listing or overwrite a submitted listing with stale draft state
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/ListingForm.tsx:142; apps/portal/app/account/listings/ListingForm.tsx:157; apps/portal/app/account/listings/ListingForm.tsx:160; apps/portal/app/account/listings/ListingForm.tsx:169; apps/portal/app/account/listings/ListingForm.tsx:173; apps/portal/app/account/listings/ListingForm.tsx:438; apps/portal/app/account/listings/ListingForm.tsx:476; apps/portal/app/account/listings/ListingForm.tsx:505; apps/portal/app/account/listings/actions.ts:239
- What's wrong: Auto-save blocks another auto-save but manual submit does not wait for `autosavingRef`. Both payloads are built before the first create returns, so both can carry no id and create separate rows. For an existing draft, the server unconditionally writes the client-supplied status, so a stale tab's later auto-save can demote a listing that another tab already submitted as PENDING.
- Failure scenario: On a new form, the 15-second tick starts while the seller taps Submit; the draft request and submit request each carry `id: undefined`, leaving one PENDING listing and one orphan DRAFT. Alternatively, two tabs edit the same draft; tab A submits, then tab B auto-saves and changes the row back to DRAFT, silently removing it from moderation.
- Suggested fix: Disable/manual-queue submit while auto-save is in flight, adopt the returned id before constructing any later payload, and enforce lifecycle compare-and-set server-side (a DRAFT save must update only a row that is still DRAFT). A per-form idempotency key would close the create race across tabs/devices.
- Blast radius: Sellers using the full listing form, especially on slow mobile connections; moderation receives duplicates or misses a submission.

### [P1] New Obour SELECT filters ignore every post-migration list-item value
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/market/page.tsx:55; apps/portal/app/market/page.tsx:59; apps/portal/app/market/page.tsx:81; packages/db/prisma/migrations/20260703100000_option_lists/migration.sql:24; packages/db/prisma/migrations/20260703100000_option_lists/migration.sql:47
- What's wrong: The market filter loads only legacy `AttributeOption` choices and filters only `ListingValue.optionId`. New saves use `listItemId`; the migration populated `listItemId` for old rows but new rows have no legacy `optionId` fallback to match.
- Failure scenario: A visitor selects a city/district/other shared-list facet. Pre-migration listings can match, while every listing saved after the option-list migration is excluded, producing incomplete or zero results even though matching listings are public.
- Suggested fix: Load the linked `optionList.items`, map query keys to list-item ids, and filter with an OR over `listItemId` plus legacy `optionId`, matching the established `listItem ?? option` read rule.
- Blast radius: New Obour marketplace filtering for every filterable SELECT/MULTI_SELECT attribute backed by a shared option list.

### [P1] EAV writes and required-field checks trust the payload shape instead of the attribute schema
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/actions.ts:62; apps/portal/app/account/listings/actions.ts:125; apps/portal/app/account/listings/actions.ts:174; packages/partner-portal/src/listingSave.ts:41; packages/partner-portal/src/listingSave.ts:79; packages/partner-portal/src/listingSave.ts:126
- What's wrong: Both save actions verify only attribute applicability. They do not verify that a value uses the column required by the attribute type, that an option belongs to that attribute/list, or that classifier ids belong to the correct classifier and parent chain. The required check accepts any non-empty field on the object, even one that the public renderer cannot display for that attribute type.
- Failure scenario: An authenticated seller submits `{ attributeId: <required-city-select>, bool: false }`, or supplies a list item from an unrelated option list. The generic check marks the city answered and the row is stored, but the SELECT renderer has no valid city choice; after moderation the public listing is missing or shows a semantically wrong required detail.
- Suggested fix: Add one shared server validator that loads attribute type/list ownership and classifier identity/nesting, normalizes each value into its permitted column, rejects cross-list ids, and runs required checks against those normalized values before the transaction.
- Blast radius: Listing data integrity and all public/admin consumers of EAV values; reachable by any authenticated customer or partner who tampers with the action payload.

### [P1] Moderation and reactivation can publish listings without rechecking required details
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/actions.ts:557; apps/portal/app/admin/(protected)/marketplace/actions.ts:562; apps/portal/app/admin/(protected)/marketplace/actions.ts:619; apps/portal/app/admin/(protected)/marketplace/actions.ts:626; apps/portal/app/account/listings/actions.ts:360
- What's wrong: Required details are checked in the two form save actions only. `approveListing` and the ARCHIVED→PUBLISHED path update status directly, while `setMyListingStatus` can also accept a forged PENDING transition without the required validator.
- Failure scenario: An attribute becomes required after a listing entered the queue, or a seller moves an incomplete draft to PENDING by invoking the status action. An admin clicks Approve and the incomplete row becomes public. An old incomplete archived listing can likewise be reactivated directly.
- Suggested fix: Extract the required/applicability validator into a shared server module and call it on every transition to PENDING or PUBLISHED, including approval and reactivation. Return the missing attribute labels to the moderation UI.
- Blast radius: Any listing submitted before a required-rule change, any legacy archived listing, and tampered seller submissions.

### [P1] The archive toggle can turn a rejected or sold listing into a published available listing
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/listings/page.tsx:73; apps/portal/app/admin/(protected)/marketplace/listings/ListingAdminActions.tsx:21; apps/portal/app/admin/(protected)/marketplace/actions.ts:619
- What's wrong: The same archive control is rendered for every non-PENDING recent status. Its first click converts any non-archived row to ARCHIVED; the next click always converts ARCHIVED to PUBLISHED, without remembering or validating the prior lifecycle state.
- Failure scenario: Staff click “Deactivate” on a REJECTED listing and later “Activate.” The listing bypasses rejection/resubmission and appears publicly. The same two clicks on SOLD relist a sold property as available, potentially while retaining stale sold-price data.
- Suggested fix: Restrict the archive toggle to PUBLISHED↔ARCHIVED, or store/restore the prior status explicitly. Require the normal moderation transition for REJECTED/DRAFT and an explicit “mark available again” flow for SOLD.
- Blast radius: Rejected and sold listings shown in the recent moderation table; public inventory accuracy.

### [P1] Price validation permits negative values and normalizes zero inconsistently across public surfaces
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/actions.ts:214; apps/portal/app/account/listings/actions.ts:219; packages/partner-portal/src/listingSave.ts:162; packages/partner-portal/src/actions.ts:72; apps/portal/app/page.tsx:120; apps/portal/app/owner/[id]/page.tsx:59; apps/portal/app/market/page.tsx:182; apps/brokerage/lib/listings.ts:181; apps/brokerage/lib/listings.ts:182; apps/brokerage/app/_components/StoreLandCard.tsx:53
- What's wrong: The full-form action accepts any price and accepts any non-NaN lowest price, including negative and infinite values. Partner price/sold-price paths accept zero. Some public mappers treat `<= 0` as “on request,” while the New Obour home/owner/area cards use only non-null checks and the Al Sawarey sold UI renders a zero sold price literally.
- Failure scenario: A seller types `-1` or `0`. The market results/detail can say “price on request,” while the home page or owner page shows `-1 EGP`/`0 EGP`; a sold Al Sawarey card can show a final sold price of `0 EGP`.
- Suggested fix: Centralize price normalization at every write: finite positive values persist, blank/zero become null, negatives/non-finite values return a validation error. Apply the same rule to `soldPrice` and a finite non-negative rule to the internal floor, then make all display mappers consume the normalized representation.
- Blast radius: Listing cards/details across both brands, partner analytics, and staff/owner price data.

### [P1] Non-canonical partner phone identities bypass password lockout and can resolve to the wrong account
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/auth/src/index.ts:83; packages/auth/src/index.ts:85; packages/auth/src/index.ts:93; packages/auth/src/loginGuard.ts:13; packages/auth/src/otp.ts:51; packages/partner-portal/src/actions.ts:16; apps/portal/app/admin/(protected)/marketplace/actions.ts:251
- What's wrong: Partner login lookup mixes raw and normalized comparisons while writes persist the raw spelling. Some equivalent forms therefore fail asymmetrically (for example a locally stored `010...` is not found when the caller enters `+2010...`), while every spelling still gets a distinct lockout key; two rows holding equivalent numbers can also make `findFirst` routing nondeterministic.
- Failure scenario: An attacker cycles `010...`, `+2010...`, `002010...`, and spacing/parenthesis variants to keep guessing one partner password after each nominal lockout. A legitimate partner can also be locked out by changing format, and two accounts holding local and E.164 versions can make a login or OTP request select the wrong User row.
- Suggested fix: Canonicalize partner phones before every write and before `loginKey`, migrate existing values to one canonical representation, and enforce uniqueness on that representation. Add the documented per-IP credential-attempt ceiling as a second dimension.
- Blast radius: Every phone-identified partner account; password brute-force resistance and OTP/account routing.

### [P1] Partner write actions can alter soft-deleted listings during the recovery window
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/actions.ts:38; packages/partner-portal/src/actions.ts:51; packages/partner-portal/src/actions.ts:68; packages/partner-portal/src/listingSave.ts:159; packages/partner-portal/src/listingSave.ts:161
- What's wrong: The lean save ownership lookup and both fast-edit ownership lookups omit `deletedAt: null`. Although dashboard/edit loaders hide trash, a stale page or direct action call can rewrite the retained row, replace EAV/photos, reset it to PENDING, or change its price/status while staff expect trash to be inert and restore-only.
- Failure scenario: Staff trash a published partner listing while the partner still has an old dashboard/form open. The partner taps Hide, saves a price, or submits the edit; the hidden row changes behind staff's back, and a later Restore returns different content/status than the row that was deleted.
- Suggested fix: Add `deletedAt: null` to every partner mutation's ownership predicate and perform the ownership/deletion/status check in the same conditional update or transaction as the write.
- Blast radius: All partner listings during the 90-day soft-delete recovery period; staff recovery expectations and retained listing data.

### [P1] Partner mutation checks are TOCTOU-prone and can overwrite a transferred listing or a newer status
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/actions.ts:36; packages/partner-portal/src/actions.ts:51; packages/partner-portal/src/actions.ts:68; packages/partner-portal/src/listingSave.ts:159; packages/partner-portal/src/listingSave.ts:161
- What's wrong: Fast-edit and lean-save first read `ownerId`/`status` and then update by bare `id`; the ownership, deletion, and lifecycle predicates are not part of the write. A concurrent staff transfer, trash, moderation transition, or second partner request can therefore pass the stale read and overwrite the row.
- Failure scenario: Partner A's fast-edit request reads a PUBLISHED listing while staff transfer it to Owner B, then the bare update writes A's price/status onto B's row. Likewise, a stale lean-form request can restore ownership to A or demote a newer status after a transfer or moderation action.
- Suggested fix: Perform the mutation as a conditional update/transaction whose predicate includes `id`, current `ownerId`, `deletedAt: null`, and the allowed status (or use a version/CAS token); return a conflict/refresh error when zero rows match.
- Blast radius: Partner listings edited during staff transfers, trash/restore, moderation, or concurrent phone submissions; ownership and lifecycle integrity.

### [P1] Lean listing creation is not idempotent and can create duplicate pending listings
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/LeanListingForm.tsx:235; packages/partner-portal/src/listingSave.ts:164; packages/partner-portal/src/listingSave.ts:166
- What's wrong: A new form submits with no idempotency key or draft id; every invocation with `input.id` absent executes `listing.create`. The client-side pending state is not a server guarantee and cannot protect against a retry, two tabs, or a replayed server action.
- Failure scenario: A slow mobile connection causes the partner to tap Submit twice or retry after an ambiguous response. Both calls create PENDING rows with the same title/phone/photos, doubling the moderation queue and public inventory once approved.
- Suggested fix: Allocate a draft/listing id before the first create and update it on retries, or require a server-issued idempotency token with a unique constraint and return the existing result for repeats.
- Blast radius: Every partner creating listings over unreliable mobile connections; duplicate inventory, moderation work, and attachment churn.

### [P1] Lean save accepts inconsistent district and neighborhood values
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/listingSave.ts:125; packages/partner-portal/src/listingSave.ts:130; apps/portal/app/account/listings/actions.ts:193; apps/portal/app/account/listings/actions.ts:207
- What's wrong: The server resolves the submitted NEIGHBORHOOD id into `Listing.neighborhoodId` but never checks that the submitted DISTRICT id is that neighborhood's `districtId`. The UI filters this relationship, but the server accepts forged or stale combinations.
- Failure scenario: A partner submits district D1 with neighborhood N2 belonging to D2. The structural link drives cards, maps, and area-derived pages to D2 while the EAV district value/search facet says D1, producing contradictory location data.
- Suggested fix: Resolve both geo values server-side and require `neighborhood.districtId === districtId` (or clear/reject the pair) before writing the listing and EAV rows.
- Blast radius: Partner and account-form listings with district/neighborhood fields; public location cards, maps, search, and aggregates.

### [P1] Fast-edit accepts Decimal-overflow prices and leaves the row stuck after the server action rejects
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/actions.ts:44; packages/partner-portal/src/actions.ts:48; packages/partner-portal/src/actions.ts:62; packages/partner-portal/src/PartnerListings.tsx:61; packages/partner-portal/src/PartnerListings.tsx:72
- What's wrong: `Number.isFinite` and the non-negative check accept values larger than the database `Decimal(14,2)` range. The subsequent Prisma update throws outside a try/catch; the client awaits the rejected action before clearing `busy`, so the row remains dimmed/disabled with no actionable error.
- Failure scenario: A partner pastes `1000000000000000` into the price or sold-price field. Prisma rejects the write, the promise rejects, and the fast-edit row remains stuck in its busy state until a full refresh while the partner receives no guidance.
- Suggested fix: Enforce the Decimal(14,2) upper bound (and a decimal-place rule) before the write, catch update failures into a localized result, and clear the client busy state in a `finally` block.
- Blast radius: Any partner fast-editing an out-of-range price; failed updates and apparently frozen dashboards.

### [P1] Fast-edit price inputs remain stale after a successful refresh and can overwrite the new value
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/PartnerListings.tsx:42; packages/partner-portal/src/PartnerListings.tsx:66; packages/partner-portal/src/PartnerListings.tsx:77
- What's wrong: The client initializes `prices` from `rows` only once. `router.refresh()` updates the server-rendered row but preserves this client state, so the input and SOLD confirmation can keep an older price and submit it again.
- Failure scenario: A listing is 100 EGP; the partner saves 200 EGP and the dashboard refreshes. The visible input still says 100, and the next Save or “Sold” confirmation writes 100 back as the asking/final price.
- Suggested fix: Synchronize local price state from refreshed rows when a row is not actively being edited, or update the local value from the successful response before refreshing; keep an explicit dirty state for active edits.
- Blast radius: Every partner fast-editing prices or marking a listing sold; silent price regression and incorrect sold-price records.

### [P1] Partner OTP endpoint enumerates valid accounts and which delivery channels they have
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/api/partner/otp/route.ts:31; apps/portal/app/api/partner/otp/route.ts:49; apps/brokerage/app/api/partner/otp/route.ts:31; apps/brokerage/app/api/partner/otp/route.ts:50
- What's wrong: An unauthenticated caller gets `not_found` for an unknown identifier but `no_phone`/`no_email` for a real, site-enabled partner lacking the requested channel. The per-IP limit does not prevent distributed enumeration.
- Failure scenario: An attacker submits candidate usernames/emails/phones and records the distinct responses to build a list of active partner accounts and their reachable channels, then targets those accounts with phishing or OTP abuse.
- Suggested fix: Return one indistinguishable response for unknown, disabled, and missing-channel cases (while logging the internal reason); keep delivery-channel details only after a verified challenge or successful send.
- Blast radius: Partner identity and contact-channel privacy on both domains.

### [P1] Al Sawarey exposes a dead-end new-listing form when the partner has no posting grant
- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: apps/brokerage/app/partner/(protected)/listings/new/page.tsx:10; packages/partner-portal/src/LeanListingForm.tsx:387; packages/partner-portal/src/listingSave.ts:75
- What's wrong: The brokerage route renders the full lean form without checking `ownerAllowedCategory`, unlike the portal route. A partner with zero grants sees an empty Type selector and can fill the form, but every submission is rejected by the server as `category_not_allowed`.
- Failure scenario: Staff create a partner account for Al Sawarey but grant no posting category. The partner follows “Add listing,” spends time entering details on a phone, and reaches an unhelpful save failure with no path to request access.
- Suggested fix: Mirror the portal route's server-side `hasGrant` gate and show a large bilingual “No posting categories granted—contact admin” state with a return link; retain the action check as defense in depth.
- Blast radius: Al Sawarey partners without category grants; wasted work and support contacts for low-tech users.

### [P1] Attachment claiming lets a partner move files out of a listing now owned by someone else
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/listingSave.ts:171; packages/partner-portal/src/listingSave.ts:173; apps/portal/app/account/listings/actions.ts:291; apps/portal/app/account/listings/actions.ts:294; apps/portal/app/account/listings/actions.ts:314; packages/db/prisma/schema.prisma:212
- What's wrong: Both partner-accessible save actions authorize an attachment solely by `uploaderId` and then overwrite its polymorphic owner. They do not require the file to be an unattached draft or already attached to the target listing, so uploader provenance is incorrectly treated as perpetual ownership.
- Failure scenario: Partner A uploads a photo for Listing X, then staff transfer X to Owner B. A submits that attachment id on another listing they still own; the update reassigns the row to A's target listing, silently removing B's gallery photo without touching B's listing action.
- Suggested fix: Claim only attachments matching the user and either `(ownerType/ownerId are null)` or `(ownerType = 'Listing' and ownerId = target listing)`. Reject, rather than silently ignore, any supplied id outside that set; apply the same rule to attribute attachments.
- Blast radius: Transferred partner listings and any attachment whose original uploader no longer owns its current parent.

### [P1] Partner self-service accepts invalid email addresses and passwords below the platform minimum
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/AccountForm.tsx:24; packages/partner-portal/src/AccountForm.tsx:42; packages/partner-portal/src/actions.ts:14; packages/partner-portal/src/actions.ts:19; packages/auth/src/password.ts:4
- What's wrong: The account action validates phone but never calls `isValidEmail` or enforces `MIN_PASSWORD_LENGTH`. The email input is not submitted through a form—the button calls the action directly—so browser `type="email"` constraint validation is also bypassed.
- Failure scenario: An OTP-only partner clears username/phone, enters `x` as email, and taps Save. The action accepts it, leaving no deliverable OTP destination and no password; after sign-out the partner is locked out. Any partner can also replace a stronger password with a one-character password even though the platform defines a six-character minimum.
- Suggested fix: Validate email and password length server-side with the shared config/auth helpers, mirror those checks client-side, and return explicit localized `invalid_email`/`password_short` guidance. Consider verifying a new email/phone before making it the sole login route.
- Blast radius: Every partner using self-service account settings; account availability and credential strength.

### [P1] Partner OTP messages use the wrong brand and sometimes the wrong language
- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: packages/auth/src/otp.ts:63; packages/auth/src/otp.ts:70; apps/brokerage/app/api/partner/otp/route.ts:23; apps/brokerage/app/api/partner/otp/route.ts:43; apps/portal/app/api/partner/otp/route.ts:40; apps/portal/app/api/partner/otp/route.ts:46
- What's wrong: The shared SMS/email templates hard-code “New Obour,” so every Al Sawarey partner code carries the other site's identity. The New Obour route additionally hard-codes Arabic when calling both senders, ignoring the locale that the shared login form posts.
- Failure scenario: An English Al Sawarey partner requests a login code and receives an English message branded New Obour; an English New Obour partner receives Arabic content. On a relative's phone this looks unrelated or suspicious and the code may be ignored.
- Suggested fix: Pass a trusted site/brand plus the validated request/cookie locale into the OTP template; provide bilingual brand-specific subjects and bodies and keep the code prominent.
- Blast radius: Every partner OTP login on Al Sawarey and every English partner OTP login on New Obour.

### [P1] The site-access controls falsely tell staff they control public listing visibility
- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: apps/portal/app/admin/(protected)/marketplace/owners/[id]/OwnerEditor.tsx:214; apps/portal/app/admin/(protected)/marketplace/owners/[id]/OwnerEditor.tsx:216; packages/partner-portal/src/visibility.ts:6
- What's wrong: The admin helper says the toggles control both where the partner signs in and where listings appear. The authoritative product rule and visibility helpers deliberately make them login-only and publish partner listings on both sites.
- Failure scenario: Staff disable New Obour for a partner believing the on-screen promise will hide that owner's offers there. The login is blocked for new sessions, but every published listing remains visible on New Obour, creating a real operational disclosure opposite to the action staff thought they took.
- Suggested fix: Change the helper to explicitly say “Controls sign-in only; published partner listings remain visible on both sites,” in both languages, and add a separate listing-level visibility workflow only if the product needs one.
- Blast radius: Staff managing any site-restricted partner and all of that partner's public listings.

### [P1] The lean form's Cancel link discards all unsaved listing work without warning
- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: packages/partner-portal/src/LeanListingForm.tsx:185; packages/partner-portal/src/LeanListingForm.tsx:231; packages/partner-portal/src/LeanListingForm.tsx:441
- What's wrong: The lean form has no draft persistence or dirty-state guard, and Cancel is a plain navigation link beside Submit. Any typed fields and selected photos are abandoned immediately; already uploaded photo rows also remain as unattached drafts.
- Failure scenario: A low-tech partner completes a long mobile form, accidentally taps the nearby Cancel link, and is returned to the dashboard with no confirmation and no recovery path. Reopening Add/Edit starts from the last server state, losing the session's work.
- Suggested fix: Track dirty state and require a plain-language Leave/Keep editing confirmation for Cancel and navigation. Prefer local/server draft recovery with an explicit saved/unsaved indicator; clean up abandoned draft uploads on expiry.
- Blast radius: Every partner creating or editing through the lean form, especially on small phones and slow connections.

### [P1] Fast availability controls publish or hide listings immediately with no confirmation
- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: packages/partner-portal/src/PartnerListings.tsx:73; packages/partner-portal/src/PartnerListings.tsx:169; packages/partner-portal/src/PartnerListings.tsx:174
- What's wrong: “Available” and “Hide” call the server action on the first tap. The adjacent controls change the public lifecycle immediately, and restoring ARCHIVED to PUBLISHED affects both public brands by design, but the UI provides no confirmation of that consequence.
- Failure scenario: A partner using a 320px phone taps Available instead of Sold/Hide. An archived row is republished across both sites before the success toast appears; there is no pre-action explanation or undo.
- Suggested fix: Confirm public availability changes with large worded buttons that name the outcome and both-site scope, or provide a short-lived Undo toast backed by a safe compensating action. Keep the existing sold-price confirmation step.
- Blast radius: Partners fast-editing PUBLISHED/ARCHIVED inventory and buyers seeing accidentally changed availability.

### [P2] Lean listing saves have no title/decimal bounds and turn oversized input into an opaque failure
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/partner-portal/src/listingSave.ts:69; packages/partner-portal/src/listingSave.ts:146; packages/db/prisma/schema.prisma:547; packages/db/prisma/schema.prisma:550
- What's wrong: The lean action trims but does not cap the title to the database `String` limit or bound numeric fields to `Decimal(14,2)`. Oversized values reach Prisma; the transaction returns only the generic `failed` result, with no field-level instruction to the partner.
- Failure scenario: A partner pastes a title longer than 191 characters or a 15-digit price. The save fails after the long form is completed, and the UI only says “Could not save, check the fields.”
- Suggested fix: Enforce shared max lengths and the exact Decimal(14,2) range before the transaction, returning localized title/price guidance.
- Blast radius: Partner listing creation/editing with long pasted text or large figures; abandoned work and support load.

### [P2] Bulk poster regeneration processes and recreates assets for trashed listings
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/actions.ts:540; apps/portal/app/admin/(protected)/marketplace/listings/[id]/poster-actions.ts:11-20; apps/portal/lib/poster/generate.ts:80; apps/portal/lib/poster/generate.ts:230; apps/portal/app/admin/(protected)/settings/poster-identity/actions.ts:44
- What's wrong: The bulk query selects every `PUBLISHED` row without `deletedAt: null`; saving poster identity settings similarly marks all published rows stale. The direct `generateListingPosters` action also accepts any listing id and calls the same generator without a deleted/status guard. `regenerateListingImages` then reads the trashed listing, deletes its existing poster attachment rows, creates a full new set, and clears `postersStale` even though trash is meant to be inert and restore-only.
- Failure scenario: A published listing is trashed, then staff change poster branding or call the per-listing regeneration action. The hidden row consumes rendering time and storage and receives newly generated assets that may later be orphaned or unexpectedly appear if restored.
- Suggested fix: Add `deletedAt: null` to both the stale-marking `updateMany` and bulk-regeneration id query, and reject deleted/non-published ids inside `generateListingPosters`/`regenerateListingImages` as defense in depth.
- Blast radius: Admin bulk poster jobs, media storage, and every trashed listing whose retained status is `PUBLISHED`.

### [P0] Settings VIEW permission exposes downloadable database and upload backups
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/settings/backups/page.tsx:10; apps/portal/app/admin/(protected)/settings/backups/download/route.ts:19
- What's wrong: The backups page and download route both require only `settings:VIEW`. A read-only settings grant can therefore stream `.sql.gz` database dumps and `.tar.gz` uploads archives, including password hashes, owner/customer PII, and internal media.
- Failure scenario: A staff account intended only to inspect settings opens the backup URL (or calls it directly with a known filename) and downloads a complete database or uploads archive without a backup-specific grant.
- Suggested fix: Gate backup inventory/downloads with a dedicated backup permission (or `settings:MANAGE`/`UPDATE`) and keep ordinary settings VIEW limited to non-sensitive configuration/status.
- Blast radius: All retained database dumps, uploaded documents/media, and every account represented in them.

### [P0] Staff editor can self-assign SUPER_ADMIN and convert arbitrary users into staff
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/settings/users/actions.ts:28-60; apps/portal/app/admin/(protected)/settings/users/page.tsx:15-20; packages/auth/src/rbac.ts:20-27
- What's wrong: `upsertStaff` accepts caller-supplied `roleKeys` (the role list includes `SUPER_ADMIN`) while requiring only `staff:CREATE`/`UPDATE`; it also updates any supplied user id without first requiring that the existing row is STAFF. A limited staff editor can grant the wildcard role to self or another account, overwrite a customer/partner's credentials, and gain full RBAC.
- Failure scenario: A user with only staff UPDATE calls `upsertStaff({ id: ownId, roleKeys: ['SUPER_ADMIN'] })`; `applyStaffRoles` installs the wildcard role, after which every protected admin section authorizes. The same action can turn a partner/customer id into STAFF and replace its password/email.
- Suggested fix: Restrict role assignment to a dedicated elevated permission, reject `SUPER_ADMIN` except for an explicitly protected bootstrap path, prevent self-escalation, and require `id` targets to already be STAFF (or use separate create/update schemas with type predicates).
- Blast radius: Complete administrative takeover and credential/domain corruption for every staff, partner, and customer account.

### [P0] Customer-management actions are IDORs across all user types and can reactivate staff/partners
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/settings/users/actions.ts:62-90
- What's wrong: `upsertCustomer` and `setCustomerVerified` update by bare user id after only a `customers` permission check. They do not constrain the existing `User.type`; `setCustomerVerified` also forces `isActive: true`. A customer manager can rewrite a STAFF or PARTNER row as CUSTOMER or reactivate an account outside the section.
- Failure scenario: A caller with customers UPDATE submits a known staff/partner id, changes phone/name/type, or calls `setCustomerVerified(id, true)` to re-enable a disabled privileged account. Existing owner links can be left inconsistent while the target's login state changes.
- Suggested fix: Add `where: { id, type: 'CUSTOMER' }` (or load-and-reject non-customers) before every customer mutation; never reactivate arbitrary users from verification; make type/ownership transitions explicit, separate, and elevated.
- Blast radius: Cross-domain account takeover, broken owner/partner relationships, and unauthorized reactivation of disabled accounts.

### [P1] Any active STAFF can mint the cross-app owner-PII admin viewer
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/store-admin/route.ts:6-15
- What's wrong: The cross-app entry route checks only `user.type === 'STAFF'` and never calls `requirePermission`. It mints an admin-view token that the brokerage uses to show owner names, phone numbers, WhatsApp flags, and details on listings.
- Failure scenario: A support/analytics-only staff member calls `/admin/store-admin` and is redirected into Al Sawarey's owner-detail view for arbitrary listings, despite lacking an owners/PII grant.
- Suggested fix: Require a dedicated owner-view permission (for example `owners:VIEW`) before minting the token, and apply the same check in the brokerage-side viewer helpers.
- Blast radius: Owner contact data across the brokerage inventory; violates least privilege for every limited-role staff account.

### [P1] Cross-app admin handoff can redirect users to an internal localhost origin
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/brokerage/app/admin-enter/route.ts:17; apps/portal/app/admin/(protected)/store-admin/route.ts:11
- What's wrong: The handoff builds its redirect with `process.env.BROKERAGE_URL || req.url`, and the portal guard falls back to `http://localhost:3001`. Behind nginx, `req.url` is the internal `http://localhost:PORT` origin; if either public environment variable is missing or misconfigured, the browser is sent to an unreachable/internal URL.
- Failure scenario: A production admin handoff runs during an environment/configuration drift and redirects the staff browser to `localhost:3002` rather than alsawarey.com, breaking the flow and exposing deployment topology.
- Suggested fix: Require configured public origins at startup and fail closed (or use relative `Location` headers) instead of deriving an absolute origin from `req.url` or hard-coding localhost.
- Blast radius: Cross-app admin access outage and internal-origin disclosure during configuration drift.

### [P1] Brokerage admin-view cookie remains valid after staff deactivation or permission revocation
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/brokerage/app/admin-enter/route.ts:17-24; apps/brokerage/lib/adminView.ts:8-11
- What's wrong: The handoff route checks `isActive` only once, then issues an eight-hour cookie. `getAdminViewer` later verifies only the HMAC/expiry and never re-queries the staff row or its current owners permission.
- Failure scenario: Staff revoke an account or its owner-view grant, but an already-issued `sw_admin` cookie continues to authorize owner phone/details until expiry.
- Suggested fix: Revalidate an active STAFF with the required permission on every owner-detail/badge read (or use short-lived tokens plus a revocation/version check) and clear invalid cookies.
- Blast radius: Up to eight hours of stale privileged PII access after offboarding or incident response.

### [P1] Admin route and action guards trust stale JWT staff status and grants
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/auth/src/config.base.ts:19-30; packages/auth/src/index.ts:134-140
- What's wrong: Middleware admits every `/admin` request when the JWT says `STAFF`, and `requirePermission` authorizes from JWT-copied `perms` without re-reading `User.isActive`, current type, or current roles. Disabling a staff account or revoking a grant therefore has no effect until the token expires.
- Failure scenario: Staff offboard an account or remove a sensitive permission, but the existing browser session continues calling previously authorized admin pages/actions (including writes) during the JWT lifetime.
- Suggested fix: Revalidate active STAFF and effective permissions server-side for sensitive routes/actions (or add a short TTL/revocation version checked by callbacks); do not rely on middleware's type-only JWT check for revocation.
- Blast radius: Every admin permission and write path during the stale-session window, including incident response/offboarding.

### [P1] Ungated poster-list server action discloses arbitrary listing media paths
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/listings/[id]/poster-actions.ts:23-24
- What's wrong: Exported `listListingPosters(listingId)` is a `use server` action with no auth or permission check and returns poster/image paths for any id, including drafts and trashed listings.
- Failure scenario: An unauthenticated caller invokes the action directly with a known listing id and receives non-public generated media paths.
- Suggested fix: Require `listings:VIEW` (and apply the same deleted/status visibility predicate where appropriate) inside the action.
- Blast radius: Internal listing media and retained trash rows for every listing id that can be guessed or enumerated.

### [P1] Ungated rationing scan report leaks filenames and batch metadata
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/rationing/scans/actions.ts:109-168
- What's wrong: `buildScanReport` performs a sensitive scan/attachment read without `requirePermission('sheets','VIEW')`, unlike the sibling scan actions.
- Failure scenario: A direct server-action call returns scan filenames/paths and sheet/import-batch matching details to an unauthenticated or low-privilege caller.
- Suggested fix: Gate the exported report action with the same sheets VIEW (or dedicated rationing-report) permission and enforce it at the read boundary.
- Blast radius: Internal rationing source files and operational metadata.

### [P1] Ungated amenity-list helper mutates taxonomy and settings
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/lands/actions.ts:687-695
- What's wrong: `getAmenityCategoryListId` is exported as a server action with no permission check but can create an `OptionList` and write a `Setting` on first call.
- Failure scenario: Any caller invokes the action repeatedly to create configuration rows or race the canonical amenity list, without a lands grant.
- Suggested fix: Make this a private server helper called only after a gated page/action, or require `lands:UPDATE` for the mutating ensure path and make creation idempotent.
- Blast radius: Catalog/taxonomy corruption and unauthorized configuration writes.

### [P1] Staff with analytics VIEW can create or delete shared saved views
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/analytics/actions.ts:13-35
- What's wrong: Both `saveAnalyticsView` and `deleteAnalyticsView` require only `analytics:VIEW`, although they mutate shared administrator state.
- Failure scenario: A read-only analytics user overwrites or deletes saved filters used by other staff and dashboards.
- Suggested fix: Require `analytics:CREATE`/`UPDATE` for save and `analytics:DELETE` for delete (or a dedicated manage permission).
- Blast radius: Shared analytics presets and downstream staff workflows.

### [P1] Watermark brand-contact deletion is authorized by UPDATE instead of DELETE
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/settings/watermark/actions.ts:194-201
- What's wrong: `deleteBrandContact` calls `requirePermission('appearance','UPDATE')`, so an editor who may change presentation can permanently remove brand contact rows.
- Failure scenario: An UPDATE-only appearance user calls the action with any contact id and deletes it; the UI's delete affordance does not add a stronger server-side check.
- Suggested fix: Gate deletion with `appearance:DELETE` (or a dedicated contact-manage permission).
- Blast radius: Brand watermark/footer contact data and public stamped output.

### [P1] Lands map actions trust arbitrary attachment ids and can clear maps before validation
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/lands/actions.ts:414-431; apps/portal/app/admin/(protected)/lands/actions.ts:462-500
- What's wrong: `setMasterplan` clears the current map before checking that the replacement attachment belongs to the caller, and `setAreaMap`/custom-photo flow reassigns any attachment id without uploader/unattached ownership checks. Listing-level maps also update trashed listings.
- Failure scenario: A lands editor submits a foreign or invalid attachment: the existing masterplan is detached and the call still returns success; or an attachment from another workflow is silently claimed and stamped onto any target id.
- Suggested fix: Validate attachment ownership/state first, update old/new ownership transactionally only after validation, and reject deleted listing targets.
- Blast radius: Irrecoverable map loss, cross-workflow attachment theft, and stale media work on trashed inventory.

### [P1] Moderation actions can publish or mutate trashed listings by id
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/marketplace/actions.ts:558-591; apps/portal/app/admin/(protected)/marketplace/actions.ts:603-631; apps/portal/app/admin/(protected)/marketplace/actions.ts:670-675
- What's wrong: `approveListing`, `rejectListing`, and `toggleFeatured` update by bare id without a `deletedAt: null` precondition. Approval can set a trashed row to PUBLISHED, regenerate posters, assign an ad number, and announce public URLs. `deleteListing` also refreshes `deletedAt` on an already-trashed row, postponing the 90-day purge.
- Failure scenario: A stale UI or direct action call replays an id from the trash page. Approval republishes the hidden listing and triggers indexing/media work; repeated delete calls keep its retention clock alive indefinitely.
- Suggested fix: Add `deletedAt: null` to ordinary moderation update predicates, reject trash rows before side effects, and make soft-delete an idempotent compare-and-set that never resets an existing timestamp. Keep restore/purge as the only trash transitions.
- Blast radius: Public reappearance of deleted inventory, unwanted notifications/storage work, and indefinite retention of rows meant for purge.

### [P1] Rationing imports are non-unique and non-atomic
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/rationing/actions.ts:175-247; packages/db/prisma/schema.prisma:961; packages/db/prisma/schema.prisma:979-980
- What's wrong: `commitImport` reads existing `dedupeKey` values once, then creates/updates each sheet and its names in a loop. The schema has only a non-unique index, so concurrent imports can both pass the read and insert the same key; there is also no transaction, so a later row/name failure leaves a partially committed batch and misleading counts.
- Failure scenario: Two staff uploads containing the same sheet at once and both create duplicate applicant rows. If one name insert or row update fails halfway through a large workbook, the batch remains with only the prefix of rows while the action returns the generic `commit_failed` error.
- Suggested fix: Enforce the intended uniqueness policy at the database boundary (or use an import-scoped conflict table), wrap batch/city/sheet/name writes in one transaction, and update the batch counters only after the transaction commits.
- Blast radius: Government rationing ledger accuracy, duplicate watcher matches, and staff retry behavior for every import.

### [P1] Watcher matches are consumed before a successful SMS and can double-send
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/rationing/actions.ts:314-353
- What's wrong: `runWatcherMatch` changes an active follow to `matched` before checking for a phone or the SMS result. A phone-less follow or failed send is therefore never retried. The update is also unconditional after the initial read, so two imports/rechecks can both send an alert for the same active follow.
- Failure scenario: A customer has a WATCH follow while SMS credentials are down; the follow becomes matched with no `lastNotifiedAt`, and subsequent rechecks skip it forever. Concurrent import and manual recheck both read `active`, send two messages, and then stamp the same follow.
- Suggested fix: Claim a follow with a conditional `updateMany({ where: { id, status: 'active' } })`, perform the notification, and stamp `matched`/`lastNotifiedAt` only on the successful send (with an explicit reviewed/no-phone state if needed).
- Blast radius: Missed or duplicate customer alerts and inaccurate rationing watcher operations.

### [P1] Public rationing inquiry and follow writes have no IP quota
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/rationing/actions.ts:19-45; apps/portal/app/rationing/follow/actions.ts:43-80; apps/portal/app/explore/actions.ts:35-63; apps/portal/lib/followAuth.ts:18-37
- What's wrong: `registerInquiry`, `startFollow`/`confirmFollow`, and `startAreaFollow`/`confirmAreaFollow` perform public database writes without calling the shared rate limiter. Every new valid phone can also create an unverified CUSTOMER immediately, so the OTP cooldown does not bound account/follow creation for rotating numbers.
- Failure scenario: A bot repeatedly submits inquiries and follows (or rotates valid phone numbers) to fill `InquiryRequest`, `RationingFollow`, `LandFollow`, and `User` rows, creating lead noise and storage/notification work without a per-IP or global ceiling.
- Suggested fix: Add per-IP plus global quotas before every public write, add phone/account and target deduplication, and keep a bounded cleanup path for unverified accounts and abandoned follows.
- Blast radius: Public lead queues, customer table growth, and SMS/admin workload.

### [P1] Rationing plots enumeration bypasses the anti-scrape quota and loads the full ledger
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/rationing/plots/page.tsx:18-35; apps/portal/lib/rationing/search.ts:145-174; apps/portal/lib/rationing/search.ts:176-208
- What's wrong: The plots tab never calls `consumeRationingQuota`, unlike the other rationing search/detail pages. `plotGroups` and `plotsSummary` fetch all distinct plots and group counts, then filter/sort/paginate in JavaScript, so a caller can walk every page while each request scans the entire table.
- Failure scenario: A scraper requests `/rationing/plots?q=...&page=N` with changing terms/pages and receives the full applicant/plot index despite the documented rationing budget; as the ledger grows each request consumes unbounded DB memory/CPU.
- Suggested fix: Meter the plots tab (including summary requests), push normalized filtering/counting/pagination into bounded SQL queries, and cap maximum page/offset and aggregate sizes.
- Blast radius: Sensitive public rationing data exposure and database load from unauthenticated enumeration.

### [P1] Scan registration can attach arbitrary paths or attachments
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/rationing/scans/actions.ts:10-24
- What's wrong: `registerScans` checks only `sheets:CREATE`, then trusts caller-supplied `path`, `mime`, and `attachmentId`; it neither verifies that the attachment belongs to the caller's upload nor that the path is an allowed scan file. The upsert by arbitrary `fileName` can relink an existing scan to unrelated media.
- Failure scenario: A sheets editor submits another workflow's attachment id/path, and the scan report later exposes that file as a rationing source or associates it with the wrong filename.
- Suggested fix: Resolve the attachment server-side, require an owned/unclaimed upload of an allowed document type, derive the path/mime from the row, and reject path/attachment mismatches in one transaction.
- Blast radius: Cross-workflow media disclosure and corrupted scan-to-sheet provenance.

### [P1] Direct district and neighborhood pages ignore inactive ancestors
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/explore/district/[id]/page.tsx:22-50; apps/portal/app/explore/neighborhood/[id]/page.tsx:23-59
- What's wrong: Both metadata and page loaders test only the requested row's `isActive`. A district remains directly renderable when its city is inactive, and a neighborhood remains renderable when its district or city is inactive; the active tree hides these rows, but canonical URLs do not.
- Failure scenario: Staff deactivate a city/parent district expecting its public geography to disappear. A visitor or crawler with the old district/neighborhood URL still receives names, maps, updates, amenities, and listings.
- Suggested fix: Make every public geo resolver require active ancestors (`district.city.isActive`, `neighborhood.district.isActive` and city active) and reuse that predicate in metadata, body, sitemap, and follow targets.
- Blast radius: Hidden geo content, inherited maps/updates, and listings exposed through stale URLs.

### [P1] Geo deletion leaves polymorphic AreaMap rows and stamped files orphaned
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/admin/(protected)/lands/actions.ts:109-119; apps/portal/app/admin/(protected)/lands/actions.ts:153-161; apps/portal/app/admin/(protected)/lands/actions.ts:288-296; packages/db/prisma/schema.prisma:1417-1432
- What's wrong: City, district, and neighborhood deletes remove only the geo row. `AreaMap` has a polymorphic `level/areaId` with no foreign key, and its clean/brand paths plus backing attachments are not deleted or detached, leaving dead map records and files indefinitely.
- Failure scenario: An admin deletes a district and later recreates the same key. The old map rows/files remain associated with the dead id, consume storage, and can be accidentally selected or stamped by maintenance tooling.
- Suggested fix: Delete/detach AreaMap rows and their owned attachments/files transactionally before deleting the geo node, or add an explicit ownership table/cleanup job for polymorphic maps.
- Blast radius: Orphaned geo media, retention/privacy leakage, and stale map selection after hierarchy changes.

### [P1] Geo follow writes accept mismatched targets and an unverified session phone
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/explore/actions.ts:18-45; apps/portal/app/rationing/follow/actions.ts:19-34; apps/portal/lib/followAuth.ts:18-24
- What's wrong: Follow actions persist caller-supplied district/neighborhood/block/land ids without checking that they form one hierarchy or that the target is active. When a session is already authenticated, `beginPhoneFollow` returns the session user without validating the separately supplied phone, which is then stored as the SMS destination.
- Failure scenario: A direct call combines unrelated area ids, causing one subscriber to be selected for multiple unrelated update audiences; a logged-in customer can also attach an arbitrary third-party phone and receive future geo-update SMS routing to that number.
- Suggested fix: Resolve and validate the target hierarchy server-side, require active targets, derive the phone from the verified session user (or OTP-verify it), and add a uniqueness/idempotency key for equivalent follows.
- Blast radius: Incorrect geo notifications, subscriber privacy, and poisoned follow counts.

### [P1] Public analytics collector is an unbounded database write endpoint
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/api/collect/route.ts:20-40; apps/brokerage/app/api/collect/route.ts:19-38; packages/analytics/src/collect.ts:42-101
- What's wrong: Both mirrored `POST /api/collect` routes cap body size but apply no per-IP/global rate limit. Each accepted beacon can upsert a visitor/session and create a page view or arbitrary analytics event, and the response always hides throttling/errors.
- Failure scenario: A bot posts valid-looking `pageview`/`event` bodies in a loop, growing `VisitSession`, `PageView`, and `AnalyticsEvent` rows and poisoning dashboards without authentication or quota.
- Suggested fix: Add the shared client-IP limiter (plus a global ceiling), validate event types/paths and session ownership, and keep bounded retention/aggregation for anonymous beacons.
- Blast radius: Analytics storage, dashboard integrity, and database capacity on both sites.

### [P1] Search-event attribution can be poisoned across visitors
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/api/search-event/route.ts:23-68; apps/brokerage/app/api/search-event/route.ts:25-70
- What's wrong: The endpoint rate-limits by IP but selects the newest `SearchLog` by only `site + normalized query` (or listing id) and recency; it does not bind the event to the caller's visitor/session, and it does not verify that the listing is valid for that site.
- Failure scenario: An attacker repeatedly sends a known query/listing pair and marks another visitor's search as selected/converted, fabricating funnel attribution and potentially associating a disallowed listing with brokerage conversions.
- Suggested fix: Persist and require an unforgeable server session/visitor token, atomically claim only that session's log row, and validate listing visibility/site before recording the event.
- Blast radius: Search-intelligence rankings, conversion reporting, and cross-site attribution decisions.

### [P1] Media replacement and purge paths never remove old generated files
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/lib/stamp.ts:267-301; apps/portal/lib/poster/generate.ts:225-236; apps/portal/lib/mapStamp.ts:17-49; apps/portal/app/api/upload/route.ts:108-140
- What's wrong: Re-stamping a photo, regenerating posters, stamping map copies, or deleting/replacing an attachment updates/deletes database rows but does not unlink the prior stamped/original files. Upload also writes pure/stamped files before the attachment insert, with no cleanup on stamp or DB failure.
- Failure scenario: Repeated watermark/poster changes leave every historical rendition on disk, while a failed upload leaves unowned files. Over time storage grows without a retention bound and old internal media remains recoverable by path.
- Suggested fix: Track every generated path as owned media, unlink superseded files after a successful DB commit, clean both paths during purge/delete, and use compensating cleanup for failed uploads.
- Blast radius: Upload storage growth, stale/internal media retention, and backup size on both brands.

### [P2] Thumbnail generation is an uncapped CPU/disk cache sink
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/thumb/[...path]/route.ts:14-45; apps/brokerage/app/thumb/[...path]/route.ts:14-45
- What's wrong: The mirrored thumbnail routes have no rate limit, per-source work budget, cache eviction, or cache-size cap. A miss runs `sharp` and writes an immutable cache file for any known image path and each of four widths.
- Failure scenario: A caller varies valid upload paths/widths to force repeated image decodes and unbounded `.thumbs` growth, consuming CPU and disk even though the source files are unchanged.
- Suggested fix: Rate-limit misses, deduplicate in-flight work, enforce cache quotas/eviction, and prefer a bounded image CDN/worker for public transforms.
- Blast radius: Public media availability and upload-volume storage on both apps.

### [P2] Rationing scan and upload failures leave unowned files
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/api/upload/route.ts:103-140; apps/brokerage/app/api/upload/route.ts:88-113; apps/portal/app/admin/(protected)/rationing/scans/actions.ts:17-24
- What's wrong: Upload routes persist bytes before creating an attachment and have no `try/catch` cleanup. Scan registration can then fail or be retried while the newly written file has no ownership record; the same applies when stamping fails after the pure original is written.
- Failure scenario: A DB timeout after `writeFile` returns an error to the user but leaves a file under `/uploads`; repeated scan registration or abandoned forms accumulate files that no purge job can identify.
- Suggested fix: Use a pending-upload record/transactional outbox, delete files on every post-write failure, and run a bounded orphan scanner keyed to attachment ownership.
- Blast radius: Permanent orphaned uploads and storage growth from failed or abandoned submissions.

### [P1] The analytics collector lets either public site write under the other brand and mutate an arbitrary page view
- Confidence: CONFIRMED (traced)
- Type: security / engineering
- Location: apps/portal/app/api/collect/route.ts:20-38; apps/brokerage/app/api/collect/route.ts:19-36; packages/analytics/src/collect.ts:42-95
- What's wrong: Both public routes pass the client JSON through unchanged, and `handleCollect` chooses `site` from the caller-controlled `input.site`. A caller can therefore POST to either origin with the other brand. A `pageleave` then updates `PageView` by client-supplied `pvId` alone; it is not constrained to the current session or site. The existing public write quota finding covers volume, but not this integrity boundary.
- Failure scenario: A script posts forged `site: 'alsawarey'` events to the portal and pollutes the brokerage rollups, or replays a known page-view id with fabricated duration/scroll data. Cross-site attribution and per-page engagement reports become attacker-controlled while every request still returns the expected 204.
- Suggested fix: Derive the brand from the route (or a server-only constant), reject a mismatched payload, and update a page view with `{ id: pvId, sessionId: session.id, site }` (or an equivalent ownership check). Bind event/page-view writes to the server-resolved session as well.
- Blast radius: Both brands' analytics, search/conversion attribution, and any operational decisions based on those reports.

### [P1] Analytics rollup and price snapshots materialize entire raw inventories in Node memory
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: ops/analytics-rollup.ts:18-58; apps/portal/lib/priceIndex.ts:23-84
- What's wrong: The nightly rollup uses an uncapped `visitSession.findMany` and computes unique visitors, averages, and bounces in JavaScript. The price snapshot job likewise loads every qualifying listing and land row, then performs one sequential upsert per district. Neither path streams, pages, aggregates in SQL, or bounds the requested rollup day count (`process.argv[2]` is accepted without an upper limit).
- Failure scenario: As traffic/inventory grows, one busy day or a manual backfill (the script documents `400` days) exhausts the cron process heap or runs past its window. A monthly price snapshot can similarly hold the full inventory and take a long time while serial upserts block the next scheduled run.
- Suggested fix: Aggregate counts/sums in SQL, page by indexed time/id windows, cap backfill arguments, and use a bounded transaction or batched `createMany`/upsert strategy with progress checkpoints.
- Blast radius: Missed daily analytics rollups, unreliable long-term dashboards, and delayed price-index snapshots on both sites.

### [P1] Scheduled and manual backup runs have no lease or idempotency guard
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: packages/backup/src/service.ts:206-263; packages/backup/src/service.ts:270-283
- What's wrong: `runDueBackups` checks `lastRunAt` and then calls `runTier`, while `runTier` unconditionally creates a RUNNING row. There is no database lease/unique running marker, compare-and-set, or process lock, and the manual path uses the same function.
- Failure scenario: Two cron ticks overlap, or an administrator clicks Run now while a scheduled tick is active. Both build and upload the same tier, both prune based on their own listing, and both stamp `lastRunAt`; an interrupted process can also leave a RUNNING row that does not prevent a later duplicate. Retention and the audit history then no longer describe one authoritative run.
- Suggested fix: Claim a tier with an atomic lease/heartbeat (and recover stale RUNNING rows), or use a host-level lock around each tier. Make the remote name/run idempotency key part of the claim so a second caller cannot upload/prune concurrently.
- Blast radius: Off-site backup retention, disk/bandwidth usage, restore confidence, and the scheduler's ability to prove a tier actually ran.

### [P1] Off-site backups do not verify the SFTP server's host key
- Confidence: CONFIRMED (traced)
- Type: security
- Location: packages/backup/src/transport.ts:71-84; ops/offsite-backup.sh:60-66
- What's wrong: The SFTP transport supplies host, port, username, and password but no `hostVerifier`/known-hosts policy. The legacy rsync script explicitly uses `StrictHostKeyChecking=accept-new`, which trusts the first key it sees. There is no configured fingerprint or pinned known-hosts file.
- Failure scenario: DNS, routing, or a first-connection MITM redirects a backup upload to an impostor. The attacker can receive database dumps and the archive's `.env` secrets, or a restore operator can later trust tampered backup contents, while the client reports a successful transfer.
- Suggested fix: Require a pinned host key/fingerprint (or a managed known-hosts file) for both transports; fail closed on a changed or unknown key and rotate the pin deliberately with an audited admin action.
- Blast radius: Every off-site archive, including database credentials, password hashes, AUTH_SECRET, API keys, and uploaded media.

### [P1] A production backup can be marked SUCCESS while omitting the restore-critical environment file
- Confidence: CONFIRMED (traced)
- Type: engineering / security
- Location: packages/backup/src/service.ts:138-175; packages/backup/src/service.ts:243-256
- What's wrong: `buildArchive` catches every `.env` read error, records a manifest without `env`, and still returns a normal archive. `runTier` then records `SUCCESS` based only on upload/size verification. The warning is visible in logs, but the status used by the scheduler/admin UI does not distinguish a DB-only result from a complete restore bundle.
- Failure scenario: A production `ENV_FILE` path is missing, unreadable, or points at the wrong deployment. The cron uploads a DB-only tarball and stamps the tier/config as successful; after a VPS loss, the archive cannot recreate DB/auth/provider configuration even though operations believed the backup passed.
- Suggested fix: In production require `.env` (or an explicitly versioned secret/config artifact) and fail the run when it is absent; otherwise store an explicit incomplete status/alert and make the UI and retention report the missing component.
- Blast radius: Disaster recovery for both applications and every secret/configuration needed to restore them.

### [P1] The brokerage sitemap has an unbounded listing and attachment fan-out
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/brokerage/app/sitemap.ts:7-24
- What's wrong: The route loads every qualifying listing and then every attachment for the entire id set with no `take`, pagination, sitemap partitioning, or per-listing query budget. It constructs the complete XML object in memory on every request.
- Failure scenario: Inventory growth or a crawler repeatedly hitting `/sitemap.xml` makes the brokerage process allocate the full catalogue plus all gallery paths and can exceed response/heap limits. The route already has a separate storefront-visibility defect; this is the independent scale failure.
- Suggested fix: Generate partitioned sitemap indexes, page listings by stable cursor, fetch only the first N public images per page, and cache/revalidate generated partitions.
- Blast radius: Search indexing and public availability of the brokerage app during sitemap generation.

### [P1] Analytics dashboard caps are silent and return an arbitrary sample
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/lib/analytics.ts:32-44; apps/portal/lib/analytics.ts:148-161
- What's wrong: Overview and event queries hard-cap `findMany` at 50,000/100,000 rows but have no `orderBy`, total-count comparison, or truncation flag. Once a window exceeds a cap, the KPI, series, funnel, and top lists are computed from whatever rows MariaDB returns first rather than a declared sample or complete aggregate.
- Failure scenario: A high-traffic reporting window silently undercounts pageviews/events and can change device, page, search, and conversion rankings. Staff see plausible percentages with no indication that the dashboard stopped at the cap.
- Suggested fix: Use SQL aggregates/cursors for complete totals, or explicitly sample with deterministic ordering and expose a `truncated`/sample-size warning beside every affected KPI.
- Blast radius: Analytics decisions, reports, and alerts for either site's traffic once the raw-table caps are reached.

### [P2] Backup retention accepts impossible calendar dates as valid archive timestamps
- Confidence: CONFIRMED (traced)
- Type: engineering / security
- Location: packages/backup/src/logic.ts:119-129
- What's wrong: `parseArchiveName` bounds month/day/time fields but does not round-trip-check the constructed UTC date. JavaScript normalizes names such as `20240231` into a March date, so a crafted same-prefix remote filename becomes a valid prune candidate with a misleading timestamp.
- Failure scenario: A foreign or tampered `noc-backup-*` file with an impossible day participates in sorting and can displace a legitimate archive from the retention window. The prefix guard prevents unrelated names but does not protect against malformed same-prefix files.
- Suggested fix: After constructing `Date`, verify every UTC component equals the parsed year/month/day/hour/minute/second (or use a strict calendar validator) before returning a candidate; add malformed-date tests.
- Blast radius: Retention decisions and the newest-backup safety invariant in a shared or tampered remote folder.

### [P2] Deleted-listing purge is unbounded, non-resumable, and race-prone
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: ops/purge-deleted-listings.ts:18-34
- What's wrong: The cron first loads every expired listing into memory and then executes one transaction per row without a batch limit, cursor, claim, or retry isolation. A second invocation can race the first and abort on a missing row, leaving the rest of the purge unprocessed.
- Failure scenario: A backlog of trashed listings makes the nightly process run for an unbounded time or exceed memory. If cron overlaps or an operator retries after a partial failure, one already-deleted id can terminate the whole run and postpone cleanup for every later id.
- Suggested fix: Claim/delete bounded batches by `(deletedAt,id)`, make each row idempotent (`deleteMany`/not-found tolerant), checkpoint progress, and expose metrics for remaining backlog.
- Blast radius: Permanent retention cleanup, orphan metadata/file pressure, and cron reliability during large backlogs.

### [P2] Search intelligence and land-follow notifications lack the composite indexes their scopes use
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/lib/searchAnalytics.ts:53-109; apps/portal/app/admin/(protected)/lands/actions.ts:574-614; packages/db/prisma/schema.prisma:1135-1154; packages/db/prisma/schema.prisma:1505-1527
- What's wrong: Search analytics repeatedly filters/group-bys `SearchLog` by `(site, surface, createdAt, normalized)` and fetches an unbounded distinct-term sample, but the schema has only separate `site+createdAt` and `normalized` indexes. Geo-update notification fan-out ORs `districtId`, `blockId`, `neighborhoodId`, and `landId`, while `LandFollow` has no district/block indexes. These become scans as logs/follows grow.
- Failure scenario: An admin opens analytics or publishes a geo update after the tables grow; several grouped scans and the distinct sample compete with public traffic, causing high CPU/latency and timeouts.
- Suggested fix: Add composite indexes matching the actual predicates (for example SearchLog site/surface/createdAt and site/normalized/createdAt, plus LandFollow districtId/blockId), and page/limit sample/fan-out reads.
- Blast radius: Analytics admin availability and update-notification latency under accumulated history.

### [P2] The city-mandatory backfill materializes all listing ids and values in one shot
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: ops/city-mandatory.ts:75-87
- What's wrong: The one-shot maintenance script loads every existing `ListingValue` city id into a `Set`, loads every `Listing` id, builds a potentially huge in-memory `rows` array, and sends one unbounded `createMany` without batching, duplicate handling, or a concurrent-run guard.
- Failure scenario: Running the backfill on a large production catalogue exceeds memory/packet limits or collides with a second run between the read and insert, causing a failed bulk write and leaving a partially prepared mandatory field.
- Suggested fix: Page listings by id, use an anti-join/`INSERT … SELECT` (or bounded `createMany` batches with `skipDuplicates`), and claim the migration so only one process runs.
- Blast radius: Listing edit/public detail consistency and the operational deploy window for the mandatory city migration.

### [P2] Public brand fallback redirects can expose the internal reverse-proxy origin
- Confidence: CONFIRMED (traced)
- Type: security
- Location: apps/portal/app/brand/[asset]/route.ts:56-57; apps/brokerage/app/brand/[asset]/route.ts:56-57; apps/brokerage/app/admin-leave/route.ts:5-8
- What's wrong: When the public origin environment variable is absent, these routes construct an absolute redirect from `req.url`. Behind the documented reverse proxy that value is the internal localhost origin, despite the route comments warning about it.
- Failure scenario: A misconfigured deployment or health check requests an unset/missing brand asset or exits admin view and receives `Location: http://localhost:3001/…` or `http://localhost:3002/…`, leaking topology and producing a broken public redirect.
- Suggested fix: Use a fixed per-app public default or return a relative redirect; never use `req.url` as the origin fallback.
- Blast radius: Public branding/favicons and the brokerage admin-view exit path during configuration drift.

## Section 2 — UI/UX enhancements

### Make draft-save state persistent and actionable
- Problem it solves: Auto-save failures are silently reset to idle; a seller on an unstable mobile connection has no clear “not saved” state or retry action and may leave the page believing the work is safe.
- Proposed change: Keep an explicit Unsaved / Saving / Saved / Save failed status near the sticky actions, show the last successful save time, and provide a large “Retry save” button after failure.
- Serves the GOLDEN RULE? It replaces an invisible technical state with plain words and one obvious recovery action for a low-literacy phone user.
- Expected impact: Fewer abandoned or lost listing drafts and fewer duplicate taps on Submit.
- Effort: S

### Add a moderation completeness checklist beside Approve
- Problem it solves: The queue shows title/type/price/contact but gives staff no visible proof that current required details are complete, especially after catalog rules change.
- Proposed change: Compute the shared server-side required validator for each pending row, disable Approve when incomplete, and show the missing labels with a direct Edit link.
- Serves the GOLDEN RULE? Staff get an explicit “missing X” instruction instead of discovering a generic save failure or publishing incomplete data.
- Expected impact: Faster, safer moderation and fewer incomplete public listings.
- Effort: M

### Explain the zero/blank price rule at entry time
- Problem it solves: Sellers can enter zero without knowing whether it means free, unknown, or “on request,” and current surfaces disagree.
- Proposed change: Add “Leave blank for price on request,” set appropriate `min`/`step`, and show the normalized public preview beside the field.
- Serves the GOLDEN RULE? It removes an ambiguous numeric convention and shows the exact wording buyers will see.
- Expected impact: More consistent prices and fewer staff corrections.
- Effort: S

## Section 3 — Coverage log

- Orientation: read `CLAUDE.md`, `AGENTS.md`, `security.md`, and the marketplace/EAV portion of `packages/db/prisma/schema.prisma`; checked the documented deliberate decisions before filing findings.
- Baseline: attempted `npm install` (environment launcher failure noted above); ran direct TypeScript `--noEmit` checks for `apps/portal` and `apps/brokerage` — both passed.
- Mirrored invariants: diffed both `lib/search.ts`, both `/thumb/[...path]` routes, and both `/api/listings/alive` routes. The thumb/alive differences are comments only. Search differs structurally because portal imports `normalizeArabic` while brokerage contains its copy; the reviewed executable normalization/search logic is behaviorally aligned in this pass.
- Typecheck verification: the existing local `node_modules/.bin/tsc.cmd --noEmit -p apps/portal` and `-p apps/brokerage` both pass; `npm install`/`npx` remain unavailable because the npm launcher targets a missing roaming `npm-cli.js`.
- Schema/migration: reviewed `Listing`, `ListingValue`, classifier/attribute/option-list models and `20260703100000_option_lists`.
- Full listing flow: reviewed the auto-save, required/applicability, value serialization, price, submit, and attachment/paper paths in `ListingForm.tsx`, `account/listings/actions.ts`, both account new/edit pages, both admin new routes, and the admin edit route.
- Partner flow: reviewed both apps' protected partner routes/layouts, `PartnerLogin`, Auth.js partner provider and `requirePartner`, both OTP routes, owner-editor account/site/category controls, `Account`/`AccountForm`, `Dashboard`, `Analytics`, `Browse`, `listingAssets`, `LeanListingForm`, `listingSave`, catalog loading, upload callers, fast price/availability actions, and dashboard controls. Confirmed the reported stale-JWT revocation, transfer/TOCTOU, attachment-claim, unverified-identifier, phone-format, OTP-enumeration, Decimal-bound, stale-price, geo-consistency, no-grant, cancel, and availability-confirmation defects; no additional unscoped partner IDOR was found.
- Catalog/required controls: reviewed both listing catalog loaders plus `upsertAttribute`, `setSectionRequired`, and the admin attribute form. The PHOTOS/DOCUMENTS required exemption and `false` boolean handling agree across the four client/server enforcement sites.
- Moderation/lifecycle: reviewed approval, rejection, archive/reactivate, seller status changes, moderation queue callers, and ad-number assignment. Rejection requires a non-empty reason and ad-number collision retry is guarded by the unique constraint.
- EAV reads: reviewed full/lean edit rehydration, New Obour detail rendering, Al Sawarey card/detail resolution, poster value formatting, and the New Obour filter query. The display/rehydration paths checked use `listItem ?? option`; the New Obour filter defect is reported above.
- Price confidentiality: searched all non-generated uses of `lowestPrice`; it appears only in authenticated owner/staff edit flows and was not found on a public route/API. Public APIs returning listings select ids only in the alive endpoint.
- Price presentation: traced `price`, `soldPrice`, `priceUnit`, blank/zero handling through New Obour market/home/owner/area cards, Al Sawarey mappers/cards/detail, and partner fast edits.
- Pass-2 inventory: enumerated every non-generated `prisma.listing`/`tx.listing` find, count, aggregate, and groupBy across `apps`, `packages`, and `ops`, then separately searched relation-based listing reads/counts (`Owner.listings`, wishlist/contact/negotiation relations, and `ListingViewDay`). Repeated both sweeps after classification; two consecutive sweeps produced no unclassified read.
- Public New Obour visibility: reviewed home, market grid/filter, detail + metadata + slug resolver, compare, owner, area-derived cards, sitemap/image sitemap, and alive/recently-viewed. Home/grid/compare/owner/area/sitemap reads correctly use `newObourVisibility()` (or an explicit equivalent); detail body rejects deleted rows. Metadata resolution and recently-viewed status mismatch are reported above.
- Public Al Sawarey visibility: reviewed the complete `STOREFRONT_STATUS` call graph (`latestLands`, featured, sold, list/count, detail, resolve, similar, id lists), detail follow-up reads, admin-view owner helpers, wishlist rendering, sitemap, homepage counts, and alive/recently-viewed. Catalogue/detail/wishlist-card reads are correctly gated; sitemap/count and alive drift are reported above.
- Customer retention surfaces: reviewed New Obour saved-wishlist reads/writes, listing ownership pages/edit guards, negotiation creation/history/respond actions, and Al Sawarey wishlist/contact-request history. My-listing pages and both edit routes reject trash; New Obour wishlist and live negotiation defects are reported. Historical closed negotiation/contact-request rows were treated as records, not public listing visibility leaks.
- Partner surfaces: reviewed shared dashboard, analytics, browse/detail, catalog loader, fast-edit ownership lookup, lean save lookup, listing assets, and both public visibility helpers. Dashboard/catalog/browse direct reads exclude trash; the 30-day view aggregate defect is reported. Mutation authorization is present but several writes are not atomic with their ownership/deletion/status checks, as detailed above.
- Admin/direct counts: reviewed marketplace hub, moderation lists, trash, dashboard KPIs/recents, New Obour admin market, owner detail/count relations, wishlist rankings, listing editors, and all listing reads in marketplace actions. Main moderation/new-market/editor paths correctly exclude or post-check trash; ordinary-dashboard/owner/wishlist leakage and the Al Sawarey KPI drift are reported.
- Maintenance helpers: reviewed price-index and neighborhood-area aggregates, cover fallbacks and brokerage admin helpers (safe ids supplied by visibility-gated callers), ad-number allocation (intentionally retains trashed ad numbers during recovery), required-details/stamping one-row helpers (non-public caller-scoped), seed/backfill scripts, and the city-mandatory maintenance script. The price-index materialization and city-mandatory backfill scale defects are reported above; bulk poster regeneration remains the only reported maintenance read-visibility defect.
- Purge: compared `purgeListing()` and `ops/purge-deleted-listings.ts` transaction-by-transaction; they are behaviorally identical and both refuse/select only trashed rows as appropriate. Both omit the polymorphic `ListingPaper` owner type, reported above; listing values, conditions, contacts, wishlist items, negotiations/view days and source-land relations follow the schema's documented cascade/SetNull behavior.
- Repository state: no source changes were made. The only pre-existing untracked item remains `.claude/`; this report is the sole audit artifact added by this pass.
- Pass-3 coverage note: the full partner auth/IDOR, lean-form, listing-save, and fast-edit surfaces are covered above; the remaining “not covered yet” list below now begins with Pass 12.
- Pass-4 coverage note: every portal `/admin` page/route and every `apps/portal/app/admin/**/actions.ts` export was enumerated. Protected pages/actions were checked for server-side permission gates, and cross-app admin-view, backup-download, user-management, poster, rationing, analytics, watermark, and lands-map boundaries were traced. The dashboard root uses per-section `hasPermission`; settings/account is a deliberate self-only STAFF-auth flow.
- Pass-5 coverage note: reviewed the rationing parser/normalizer, import commit and batch accounting, sheet/name/search/detail reads, plots/summary/dashboard aggregates, scan registration/reporting, watcher matching/SMS, public inquiry/follow actions, OTP helper, quota calls, and purge-adjacent scan media. Import atomicity, watcher delivery, public-write quotas, plot enumeration, and scan attachment provenance are reported; the OTP verification path and scan report permission finding were already covered above.
- Pass-6 coverage note: reviewed city/district/neighborhood public loaders and metadata, active-tree filtering, geo inheritance, amenities, area listings, derived plot areas, map/custom-photo readers, lands CRUD and map stamping, geo updates/notifications, and area follows. Inactive-ancestor URLs, polymorphic map cleanup, and follow target/phone binding are reported; inheritance defaults and listing visibility predicates were consistent with their documented policy.
- Pass-7 coverage note: compared the portal/brokerage search mirrors and traced search pages, suggestion/lead/event/collect/alive/preferences/upload endpoints and their rate-limit/visibility boundaries. Search normalization and suggestion/lead/upload/alive guards are aligned; analytics collector throttling and search-event attribution are reported.
- Pass-8 coverage note: reviewed both upload pipelines, `/uploads` serving, mirrored thumbnail routes, photo/map watermarking, poster generation, attachment ownership, and replacement/purge paths. Generated-file cleanup, upload failure cleanup, and uncapped thumbnail caching are reported; the byte-level thumbnail route behavior remains mirrored.
- Pass-9 coverage note: reviewed the analytics collector/route pair, raw analytics rollup/prune, price-snapshot and purge crons, city-mandatory/backfill scripts, backup-tick/service/transport/retention logic, local/off-site backup scripts, and admin backup status/download boundaries. Cross-brand collector identity, unbounded aggregators/purge, backup reentrancy, missing env success, host-key verification, and malformed retention timestamps are reported; the earlier backup-download RBAC finding remains separate.
- Pass-10 coverage note: reviewed public/admin sitemap and count reads, analytics/search/price aggregations, cron-scale imports/backfills, and the Prisma indexes for listings, analytics, SearchLog, LandFollow, geo updates, and backup history. Unbounded sitemap/materialization, silent analytics caps, and predicate/index mismatches are reported; the existing rationing/media scale findings remain separate.
- Pass-11 coverage note: swept both Next security-header/CSP configs, all public upload/brand/thumbnail paths, rich-HTML and JSON-LD sinks, raw SQL/process execution, environment/secret references, session/OTP boundaries, and redirect construction. The new collector identity, SFTP host-key, and localhost fallback findings are reported; existing auth/OTP/RBAC and upload findings were not duplicated. A repository secret-pattern scan found no committed private-key or cloud-key material. Dependency installation/audit remains unverified because the machine npm launcher is broken.
- Not covered yet: UI/UX passes 12–15 and the deeper backup/restore validation in Pass 16.
