# NOC — Phase 2 / 3 Roadmap (advanced features)

Scoping notes for the six advanced features from the NewObour design-system spec
(`newobour-advanced-features.md`). These are **not built yet** — this doc maps each
onto the current architecture so they can be picked up in priority order.

Conventions already in place we'll reuse: server actions returning `{ ok }`, the
`Attachment` upload pipeline (`ownerType`/`attributeId`), RBAC `requirePermission`,
the classifier model (Type/Purpose/Condition), `Owner` list, `PublicShell`, the
SMS gateway, and next-intl ar/en.

---

## 🚧 In progress — City geo level, map inheritance, area advantages, generated photos (2026-07)

Agreed with the owner; built in two phases. Full decision log lives in the assistant
memory (`maps-advantages-photos-plan`).

**Geo:** new **City** level → `City → District → Neighborhood` (`District.cityId`,
seeded with مدينة العبور الجديدة, all districts backfilled). `Advantage` gains `cityId`.

**Maps (extends `AreaMap`):** City holds 4 uploaded maps (masterplan / location /
services-areas / main-roads). District & Neighborhood have an uploaded masterplan + a
**location** map produced by **annotating the parent's masterplan** with the existing
shared `MapAnnotator` (one component, edited globally). Listings (any with a
neighborhood) get a location map by annotating the neighborhood masterplan. `AreaMap`
now carries `annotation` (editable shapes) + `sourcePath`; new `level` values `city`/
`listing` and `kind` values `services`/`mainroads`; dual clean + per-brand stamp kept.
Replacing a parent masterplan leaves children's location maps until re-saved.

**Advantages (#1–#3):** City+District+Neighborhood free-text advantages; embedded on
**both** sites' listing detail as an "Area advantages" section grouped by level (derived
from the listing's neighborhood). Public **Explore** becomes City → District →
Neighborhood with a city page (maps + advantages).

**Generated photos — Phase 2 (#4):** new server-side renderer (SVG/HTML→PNG via
`sharp`, headless for bulk). **Big poster** = title + Area (group 1, no own card) +
first-4 attribute groups + embedded location map → **3 versions** (New Obour / ALSWARY /
unbranded-for-partners, same colours/format). **Per-group cards** (every group except
Area) + a separate **advantages photo** → **2 versions** (New Obour / ALSWARY). Arabic
only. Live in the public gallery per site; unbranded poster via an admin download
button. Generated on add; **"Regenerate all"** bulk action; editing advantages/design
**marks affected listings stale**. Approved visual design still to be supplied.

**Phasing:** Phase 1 = geo City + map inheritance + advantages #1–#3 (data & rendering,
no image generation). Phase 2 = the renderer + poster/cards/advantages photos.

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

## 5. Plot Consolidation & Partnerships (تجميع الملاك والشراكات)
**Where:** marketplace filter + `/app` dashboard opt-in.
**Build:** add a `partnership` JSON/columns to `Listing` (isPartnership, partnershipType,
expectedShare). A persistent "partnership only" toggle in `MarketFilters`. A dashboard
card for small-plot owners (e.g. 209 m²) to opt in.
**Effort:** S (mostly a Listing field + a filter + a form).

## 6. Broker sub-accounts & moderation (حسابات السماسرة المعتمدين)
**Note:** we deliberately chose **staff-managed owners** (companies/brokers are `Owner`
entries; the Partners login section was retired). This feature would *reverse* that —
revisit with the user before building.
**If pursued:** restore PARTNER login accounts (OTP), a `/broker/register` commercial
signup (license number, business name), self-service listing CRUD scoped to the broker,
and broker listings entering the existing moderation queue as `PENDING`. The public
broker showroom already exists at `/owner/[id]`.
**Effort:** L. **Decision required first.**

---

## Suggested order
1. **Plot Partnerships** (#5) — smallest, pure marketplace.
2. **Build-It-For-Me** (#1) — high conversion value, self-contained.
3. **Legal Concierge** (#2) — reuses the document pipeline.
4. **Price Heatmap** (#3) — needs the monthly snapshot job.
5. **Document Verification** (#4) — gated on a payment-gateway decision.
6. **Broker sub-accounts** (#6) — only if the owner model is revisited.
