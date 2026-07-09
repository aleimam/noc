# NOC — Phase 2 / 3 Roadmap (advanced features)

Scoping notes for the six advanced features from the NewObour design-system spec
(`newobour-advanced-features.md`). These are **not built yet** — this doc maps each
onto the current architecture so they can be picked up in priority order.

Conventions already in place we'll reuse: server actions returning `{ ok }`, the
`Attachment` upload pipeline (`ownerType`/`attributeId`), RBAC `requirePermission`,
the classifier model (Type/Purpose/Condition), `Owner` list, `PublicShell`, the
SMS gateway, and next-intl ar/en.

---

## 📌 Current status (2026-07-09)

**Recently shipped & deployed:** partner portal + full-site chrome + public "become a partner"
apply flow (#6), **SEO-friendly listing URLs** on both apps (#7), first-party visitor analytics
(**Phases 1 & 2** — sessions + events + funnel + search intelligence), the watermark/stamp
**brand-split + managed contacts footer + per-listing-category
rules**, official-papers on listings, and **login hardening** (bilingual errors + 5-try
lockout, partner login tabs). Earlier: the City-geo / map-inheritance / area-advantages /
generated-photos feature (both phases) and the **ALSWARY → "Al Sawarey"** rename.

**Immediate backlog:**
- **Off-server backups** — on-server daily DB+uploads backups already exist and restore
  (`ops/RESTORE.md`); the gap is an **off-site copy** (SSH-key push from the VPS to the
  owner's backup server). VPS keypair generated; **blocked on the owner** supplying the
  backup server's host / port / user / target path + installing the VPS public key there.
- **Cloudflare** — server-side prep DONE (`ops/CLOUDFLARE.md` + `ops/cloudflare-realip.sh`).
  **Blocked on the owner** doing Part A (create zones, switch nameservers); then run Part B
  on the VPS + Part C checklist.
- **`/code-review ultra`** — owner-triggered when wanted.
- **Partner OTP-by-email** — deferred until outbound-mail deliverability (SPF/DKIM) is
  verified; partner OTP stays SMS-only until then.
- **Web analytics Phase 3** — Phases 1 (visitor/session/pageview tracking + dashboard) and 2
  (event tracking + engagement funnel + search intelligence incl. zero-result searches)
  **SHIPPED 2026-07-09**. Remaining Phase 3 = frustration signals (rage/dead clicks, form
  abandonment) + Core Web Vitals + daily rollups & **retention prune** + cohorts + saved views
  + scheduled reports. Build on request.

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

## 3. Price Heatmap (extends the new Price Index)
**Where:** `/price-index` (already live with per-district averages).
**Build:** add a 6-month trend per district (needs a small `PriceSnapshot` table or a
monthly cron capturing district averages), a side-by-side district comparator, and
infrastructure-completion bars. Plot with inline SVG (no chart lib).
**Effort:** S–M (the page exists; this is data history + comparison UI).
**Dependency:** a scheduled job to snapshot monthly averages.

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
