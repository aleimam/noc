# Codex Deep Audit Findings

Audit status: **Pass 1 of 16 complete** — listings + EAV. Passes 2–16 have not yet been performed. This report is intentionally cumulative; later focused passes should append, de-duplicate, and re-sort it.

## RESOLUTION — all 7 pass-1 defects FIXED, deployed and live-verified 2026-07-20

Every finding below was independently re-verified against the code and against production data
before being fixed. **A later pass must not re-report these.** Commits `06e58e5` → `79c61dc`.

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

Baseline: both app typechecks pass. `npm install` could not be rerun because the machine's `npm.cmd` points to a missing roaming `npm-cli.js`; the existing `node_modules` was used to run TypeScript directly. No application source, environment file, database, upload, server, migration, or deployment was touched.

## Section 1 — Defects

### [P0] Any staff account can edit every listing outside RBAC, and that path can detach internal paper records
- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: apps/portal/app/account/listings/[id]/edit/page.tsx:16; apps/portal/app/account/listings/actions.ts:94; apps/portal/app/account/listings/actions.ts:231; apps/portal/app/account/listings/actions.ts:253; apps/portal/app/account/listings/actions.ts:308; apps/portal/app/account/listings/actions.ts:360
- What's wrong: The customer-account edit page admits every `STAFF` user regardless of `listings` permission, and `saveListing`/`setMyListingStatus` treat staff type as a global ownership bypass without calling `requirePermission`. That account loader also omits official-paper state; when a staff user saves through it, the staff-only branch interprets both paper flags as false and detaches the `ListingPaper` attachments.
- Failure scenario: A support-only staff user opens `/account/listings/<known-id>/edit`, changes any seller's listing, and saves. The write succeeds despite no listings grant, and an otherwise unrelated edit clears `hasAllocationLetter`/`hasSaleMandate` and releases their paper-photo rows.
- Suggested fix: Require the matching `listings` CREATE/UPDATE permission inside the action whenever `user.type === 'STAFF'`; make the account route seller-only, and move staff editing exclusively to the permission-gated admin route. Also make omitted staff-only paper fields mean “leave unchanged,” not false/clear.
- Blast radius: Every listing and every internal allocation-letter/sale-mandate attachment; all limited-role staff accounts.

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
- Schema/migration: reviewed `Listing`, `ListingValue`, classifier/attribute/option-list models and `20260703100000_option_lists`.
- Full listing flow: reviewed the auto-save, required/applicability, value serialization, price, submit, and attachment/paper paths in `ListingForm.tsx`, `account/listings/actions.ts`, both account new/edit pages, both admin new routes, and the admin edit route.
- Partner flow: reviewed `LeanListingForm.tsx`, `listingSave.ts`, `catalog.ts`, fast price/availability actions, dashboard/listing controls, and ownership loading. Ownership scoping itself was clean in the partner save/load paths reviewed; deeper partner auth is reserved for Pass 3.
- Catalog/required controls: reviewed both listing catalog loaders plus `upsertAttribute`, `setSectionRequired`, and the admin attribute form. The PHOTOS/DOCUMENTS required exemption and `false` boolean handling agree across the four client/server enforcement sites.
- Moderation/lifecycle: reviewed approval, rejection, archive/reactivate, seller status changes, moderation queue callers, and ad-number assignment. Rejection requires a non-empty reason and ad-number collision retry is guarded by the unique constraint.
- EAV reads: reviewed full/lean edit rehydration, New Obour detail rendering, Al Sawarey card/detail resolution, poster value formatting, and the New Obour filter query. The display/rehydration paths checked use `listItem ?? option`; the New Obour filter defect is reported above.
- Price confidentiality: searched all non-generated uses of `lowestPrice`; it appears only in authenticated owner/staff edit flows and was not found on a public route/API. Public APIs returning listings select ids only in the alive endpoint.
- Price presentation: traced `price`, `soldPrice`, `priceUnit`, blank/zero handling through New Obour market/home/owner/area cards, Al Sawarey mappers/cards/detail, and partner fast edits.
- Repository state: no source changes were made. The only pre-existing untracked item remains `.claude/`; this report is the sole audit artifact added by this pass.
- Not covered yet: exhaustive soft-delete/public visibility (Pass 2), full partner auth/IDOR (Pass 3), complete admin RBAC inventory (Pass 4), rationing, geo, search endpoints beyond the EAV filter, media, analytics/ops/backups, performance/indexing, full security sweep, and UI/UX passes 12–15.
