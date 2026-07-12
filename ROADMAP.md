# NOC — Phase 2 / 3 Roadmap (advanced features)

Scoping notes for the six advanced features from the NewObour design-system spec
(`newobour-advanced-features.md`). These are **not built yet** — this doc maps each
onto the current architecture so they can be picked up in priority order.

Conventions already in place we'll reuse: server actions returning `{ ok }`, the
`Attachment` upload pipeline (`ownerType`/`attributeId`), RBAC `requirePermission`,
the classifier model (Type/Purpose/Condition), `Owner` list, `PublicShell`, the
SMS gateway, and next-intl ar/en.

---

## 📌 Current status (2026-07-12)

**Shipped 2026-07-12 (commits `9e5364d`, `877d565`):**
- **Geo Directory (الدليل الجغرافي)** — section renamed; **city-level updates** (GeoUpdate.cityId,
  editable from the City page or the central Updates section; no SMS notify — no city follows);
  **inheritance matrix** (Setting `geo.inheritance`: updates/amenities/advantages/maps ×
  City→District→Neighborhood→Listing toggles, all-on defaults, matrix card on the hub);
  inherited content tagged with source chips; collapsible "عن المنطقة" on listing pages of
  BOTH sites; **expandable family-tree** (GeoTree) atop /explore linking every unit.
- **Per-map titles + custom branded area photos** (AreaMap.title + `custom:<uuid>` kinds) at all
  three geo levels — dual-brand stamped, matrix-inherited, shown on explore + listing pages.
- IN FLIGHT: **RBAC restructure** — 7-group sidebar; `marketplace`/`settings` god-sections split
  into 13 purpose keys (listings/catalog/owners/storefront/content/appearance/analytics + kept
  keys); zero-lockout copy-then-delete migration; role presets refresh; gated dashboard tiles.

## 📌 Previous status (2026-07-11, end of day)

> The always-current pending list + server runbook live in **[CLAUDE.md](CLAUDE.md)** — this
> block is a snapshot.

**Shipped & deployed today (commits `e74ccd7` → `b9e45bc`):**
- **Price Heatmap** (#3 below) — trends, comparator, heat table, monthly cron, admin snapshots page.
- **System-wide UI/UX review** (4 parallel review agents, ~80 verified findings) → **all fixed
  and deployed** in batches: broken wa.me links (new shared `waPhone()`), Toaster mounted in both
  apps, partner photo-drop on alsawarey.com, visibility leaks (similar/compare), `updateSetting`
  RBAC whitelist, admin delete-confirms + error surfacing everywhere (shared `runAction`),
  required rejection reason, rationing /plot anti-scrape quota, mobile language switcher, real
  OTP resends, upload-error mapping (+HEIC), contrast/touch/RTL/i18n sweep, and the P3 polish
  tail (hero search sizing, theme tokens, date digits `ar-EG-u-nu-latn`, dead code).
- **Owner edit page reworked** — single bottom Save/Reset via atomic `saveOwnerFull`, unified
  cards, ad-codes at bottom, real site favicons, browse label «يمكنه تصفح جميع عروضنا»
  (PartnerPortalPanel deleted; controls live in the unified OwnerEditor).
- **Partner Browse scoped** to Al Sawarey storefront offers only (list + detail).
- **Al Sawarey**: footer name/slogan admin-editable (`StorefrontContent.footer`), real SVG
  contact logos, Partners link moved to the header.
- **Geo explorer fully public** (owner decision): city/district/neighborhood details, maps,
  advantages render without login; LoginToView removed there. Rationing gates untouched.
- Homepage title shortened to «العبور الجديد | بوابة الخدمات المجانية».

**Recently shipped & deployed (2026-07-10/11):**
- **Multi-site partner portal — COMPLETE.** The whole partner portal was extracted into
  `@noc/partner-portal` and mounted on **both** domains (`/partner` on newobour.com AND
  alsawarey.com). Admin decides per-partner site access (`Owner.siteNewObour/siteAlsawary`);
  partner logins are gated per site (`NOC_SITE` env); a partner's listings appear ONLY on their
  enabled sites (Phase 4 visibility, truth-table verified); both apps use the shared **lean
  listing form**. Backend pipeline verified end-to-end on prod; a UI click-test by a human
  remains (test account `testpartner` exists — delete after).
- **Partner email-OTP + admin OTP login** (password OR code via SMS/email).
- **Web analytics Phases 1–3 + saved dashboard views** — feature-complete.
- **Outbound mail** — Brevo relay live; BOTH domains SPF+DKIM authenticated (verified);
  Gmail inboxes, Outlook still spam (shared-IP reputation, nothing left to fix technically);
  hourly cron-bounce reputation leak fixed (Postfix transport discard).
- **Backups** — full admin page `/admin/settings/backups` (downloads, instant backup, integrity
  check, schedule + retention editors, off-site config + test, failure alerts → email×2 + SMS).
  Off-site push script + cron installed, waiting only on the owner's server details.
- **TLS** — cert reissued as a 4-name SAN (both apexes + www) and the silently-broken renewal
  fixed (webroot method; dry-run verified).
- Explore: a neighborhood with no location map inherits its district's (never shown on listings).

**Owner-action backlog (everything prepped, see CLAUDE.md for details):**
1. Cloudflare proxy flip — Part C checklist in `ops/CLOUDFLARE.md`.
2. Off-site backup server details → enter in `/admin/settings/backups`, add the VPS pubkey.
3. Rotate the Brevo SMTP key, then re-apply via `ops/mail-relay-brevo.sh`.
4. Partner portal UI click-test on both sites (then delete the `testpartner` account).
5. `/code-review ultra` when wanted.

---

## ✅ Shipped — City geo level, map inheritance, area advantages, generated photos (2026-07)

Agreed with the owner; delivered in two phases. Full decision log lives in the assistant
memory (`maps-advantages-photos-plan`).

**Geo (Phase 1, commit `d8d0d11`, migration `20260707120000_city_geo_maps`):** new
**City** level → `City → District → Neighborhood` (`District.cityId`, seeded with
مدينة العبور الجديدة, 40 districts backfilled). `Advantage` gains `cityId`. Admin Cities
section at `/admin/lands/cities`.

**Maps (extends `AreaMap`):** City holds 4 uploaded maps (masterplan / location /
services-areas / main-roads). District & Neighborhood have an uploaded masterplan + a
**location** map produced by **annotating the parent's masterplan** with the shared
`MapAnnotator` (one component, edited globally). Listings (any with a neighborhood) get a
location map by annotating the neighborhood masterplan (per-listing annotator wired in
commit `42337f1`). `AreaMap` carries `annotation` (editable shapes) + `sourcePath`; `level`
adds `city`/`listing`, `kind` adds `services`/`mainroads`; dual clean + per-brand stamp
kept. Replacing a parent masterplan leaves children's location maps until re-saved.

**Advantages (#1–#3):** City+District+Neighborhood free-text advantages; embedded on
**both** sites' listing detail as an "Area advantages" section grouped by level (derived
from the listing's neighborhood, via `advantagesForNeighborhood` + `@noc/ui`
`AreaAdvantages`). Public **Explore** is now City → District → Neighborhood with a city
page (maps + advantages).

**Generated photos — Phase 2 (commits `dde555e` renderer, `771a0b0` cards+advantages,
`2133ba8` triggers+display, `be98b87` mark-stale):** server-side renderer =
**`sharp` + SVG** (NOT Chromium — libvips shapes Arabic/Tajawal correctly; Tajawal
installed on prod at `/usr/share/fonts/tajawal/`). Code in `apps/portal/lib/poster/`
(`render.ts` = `renderPoster`/`renderCard`/`renderAdvantages`; `generate.ts` =
`regenerateListingImages`/`listListingImages`/`markAreaListingsStale`). Approved visual
identity = the **`Identity/` navy+gold assets** (Layout A poster, gold frame + navy corner
brackets + gold divider, page-wide footer; **not** flat mockups). Arabic only.
- **Big poster** = ad no. + title + prominent Area pill + neighborhood map (big) + city
  masterplan + 3 group cards → **3 versions** (New Obour / Al Sawarey / unbranded-for-partners).
- **Per-group cards** (every attribute group except Area) + a separate **advantages photo**
  → **2 versions** (New Obour / Al Sawarey).
- Stored as `Attachment` rows (`ownerType='ListingPoster'`, `stampCategory`
  `poster:`/`card:`/`adv:`<brand>). Shown in a public gallery per site + admin download
  (`PosterPanel` on the listing editor). **Generated on publish** (fire-and-forget in
  `approveListing`); **"Regenerate all"** bulk action on the marketplace overview.
- **Mark-stale:** `Listing.postersStale` (migration `20260708120000_listing_posters_stale`)
  is set when a listing's data changes, its location map is set/cleared, or its area's
  advantages change (`markAreaListingsStale` cascades city/district/neighborhood → listings);
  cleared on regenerate; `PosterPanel` shows a "regenerate to update" banner while stale.

---

## 1. "Build-It-For-Me" engine (ابنِ أرضك معنا)
**Trigger:** a tracked land/listing whose Condition (or land status) reaches *licensed*.
**Where:** customer dashboard (`/app`) + a `BuildRequestModal`.
**Build:** new `BuildRequest` model (userId, listingId?, buildingType, floors, financing,
status). A multi-step modal (preferences → financing → submit). On submit, store the
request and surface a WhatsApp deep-link to an Al-Sawarey construction consultant
(reuse the central contact setting). Admin queue to triage requests.
**Effort:** M (1 model + modal + admin list).

## 2. Legal Concierge (خدمة الكونسيرج القانوني)
**Trigger:** a positive ledger match on `/rationing`, or a manual opt-in.
**Where:** rationing result panel + `/app` dashboard.
**Build:** new `ConciergeRequest` model + a secure document dropzone (reuse the upload
route with `kind=document`; store as `Attachment` with a dedicated ownerType). Show a
transparent fee table (admin-editable Setting). Admin queue. Documents are **internal**
(same rule as DOCUMENTS attributes).
**Effort:** M.

## 3. ✅ Price Heatmap — SHIPPED 2026-07-11
**Delivered (commit `e74ccd7`, migration `20260711120000_price_snapshots`):**
`PriceSnapshot` (one row per district-month: avg EGP/m², samples, volume) written by a
monthly cron (`ops/price-snapshot.{ts,sh}`, `/etc/cron.d/noc-price-snapshot`, 1st 03:20)
and an admin **"Snapshot now"** button. Live aggregation (`apps/portal/lib/priceIndex.ts`)
now combines **published marketplace Listings** (TOTAL→price/area, SQM as-is, UNIT skipped)
**+ published Lands** (lands linked to a listing skipped — no double count), normalized to
EGP/m². `/price-index` gained: gold **heat-tinted** averages, **monthly-change** arrows,
**6-month inline-SVG sparkline** per district, and a big mobile-first **two-district
comparator** with an explicit "X أرخص من Y بنسبة Z٪" line. Admin page
`/admin/marketplace/price-index` (live table + snapshot history, marketplace RBAC).
**Notes:** infra-completion bars deliberately skipped (owner). Trend history accumulates
from 2026-07 — it cannot be backfilled. Prod had no priced+located inventory at ship time
(first snapshot = 0 rows; fills in as listings get price+area+neighborhood). The public
page is currently **hidden by the owner's module toggle** (`priceIndex: false` in
`/admin/settings/modules`) — enable it there to go public.

## 4. Premium Document Verification / escrow (طلب فحص الأوراق)
**Trigger:** an **unverified** public listing (`/market/[id]`).
**Where:** a "secure vault" box in the listing sidebar.
**Build:** add `verifiedStatus` to `Listing` (UNVERIFIED → PENDING → VERIFIED) and a
`VerificationRequest` model. Checkout is a **prohibited payment action** for the agent —
wire a real gateway (Fawry / Vodafone Cash / card) but the user completes payment; on
admin authorization the listing flips to verified (a gold "موثّق" badge, already in the
DS PropertyCard). Treat the payment integration as its own task.
**Effort:** M–L (payment gateway is the long pole).

## 5. ✅ Plot Consolidation & Partnerships (تجميع الملاك والشراكات) — SHIPPED 2026-07-08
**Delivered (commit `99e88ce`, migration `20260708150000_listing_partnership`):**
`Listing.isPartnership` + `partnershipType` (CONSOLIDATION / JOINT_BUILD / SHARE_SALE)
+ `partnershipNote`; gold opt-in block in the shared listing form (staff + seller);
persistent "شراكات فقط" toggle in `/market` filters (survives type changes); partnership
chip on cards + info box on the listing detail; account-dashboard promo card deep-linking
to `/account/listings/new?partnership=1`. Values validated server-side and cleared when
the flag is off. Deployed + verified in prod.

## 6. ✅ Partner portal (بوابة الشركاء) — SHIPPED 2026-07-08
**The owner made the call and reversed the staff-managed-only decision.** Delivered in
4 deployed phases (commits `51fb75f` → `88bfe2a`): admin-created partner accounts on the
Owner page (username/email/phone ≥1, password optional, active toggle) + explicit
per-owner **category grants**; `/partner` portal with password or SMS-OTP login,
dashboard (portfolio stats + listings), **instant fast-edit** (price + متاح/تم البيع/إخفاء),
listing CRUD restricted to granted categories entering the existing PENDING moderation
queue, self-service account page, and **analytics** (real view counter on both sites,
30-day trend, per-listing views/contacts/saves/negotiations).
**Deferred:** email OTP awaits an outbound-mail deliverability check (postfix exists;
SPF/DKIM unverified); view counting is naive (no bot dedupe).

---

## 7. ✅ SEO-friendly listing URLs — SHIPPED 2026-07-09
Human-readable `/market/<type>-<area>m-<adNumber>` URLs on **New Obour** (commit `44777c3`),
matching Al Sawarey's `/listings/<slug>-<adNumber>` (shipped earlier). The detail page
resolves either the SEO slug or a legacy cuid and **308-redirects** old cuids / mismatched
slugs to the canonical URL — the ad number (trailing digits) is the stable lookup key.
Canonical tag, sitemap, and every browse surface (market grid, home, owner profile, explore,
similar) emit the pretty href. Verified live with multiple listings (distinct slugs, 308s,
sitemap). Secondary logged-in links (wishlist/offers/compare) keep cuids and rely on the 308.

---

## Suggested order
1. **Plot Partnerships** (#5) — smallest, pure marketplace.
2. **Build-It-For-Me** (#1) — high conversion value, self-contained.
3. **Legal Concierge** (#2) — reuses the document pipeline.
4. **Price Heatmap** (#3) — needs the monthly snapshot job.
5. **Document Verification** (#4) — gated on a payment-gateway decision.
6. **Broker sub-accounts** (#6) — only if the owner model is revisited.
