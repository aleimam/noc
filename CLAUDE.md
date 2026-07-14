# CLAUDE.md — NOC platform (read me first)

Master onboarding for anyone (human or Claude session) picking up this repo. It captures the
architecture, the production runbook, and every hard-won gotcha. Deeper docs are linked at the
bottom. Last full update: **2026-07-14**.

## What this is

One Turborepo monorepo → **two live sites sharing one MariaDB backend**:

| App | Domain | Brand | Port (dev+prod) |
|---|---|---|---|
| `apps/portal` | **newobour.com** | العبور الجديدة (New Obour) — free community portal | 3001 |
| `apps/brokerage` | **alsawarey.com** | الصواري (Al Sawarey) — commercial land brokerage | 3002 |

Stack: Next.js 15 App Router · React 19 · Tailwind v4 · Prisma 7 (MariaDB, Rust-free client) ·
Auth.js v5 beta · next-intl (Arabic-first, RTL) · npm workspaces + Turborepo.

**🌟 GOLDEN RULE:** both sites' users are low-literacy / low-tech, mostly browsing on a
relative's phone. Design **biggest / simplest / most explicit, mobile-first**. Admin UI defaults
to English; public + brokerage default to Arabic (cookie wins).

## Repo layout

```
apps/portal        newobour.com  (also hosts /admin — the ONE admin for both brands)
apps/brokerage     alsawarey.com (display-only storefront; managed from the portal admin)
packages/db        Prisma schema + migrations + seeds (client generated into packages/db/generated)
packages/auth      Auth.js config, RBAC, OTP (SMS+email), login guard, site gate (NOC_SITE)
packages/ui        shared components + theme.css (navy/gold/green palette, Tajawal+Playfair)
packages/partner-portal  the ENTIRE partner portal, shared by both apps (see rules below)
packages/mail      sendMail via nodemailer → localhost:25 (Postfix → Brevo relay)
packages/sms       SMS Misr integration (working in prod)
packages/analytics first-party visitor analytics collector
packages/config    constants, validators (isValidPhone/isValidEmail), SECTIONS for RBAC
                   (12 keys since 2026-07: sheets/lands/listings/catalog/owners/storefront/
                   content/appearance/analytics/staff/customers/settings — the old
                   `marketplace` + fat `settings` god-sections were split; grants were
                   copied by migration 20260712160000_rbac_sections, zero-lockout)
packages/i18n      locale/currency/unit helpers
ops/               server scripts + runbooks (see ops/README.md — each file documented)
Identity/          brand assets. Real logos: ALSWARY = 1000X1000.png, New Obour = New Obour.png
```

## Local development (Windows ARM64 friendly)

```bash
npm install
npm run db:start        # portable MariaDB in .devdb/ on 127.0.0.1:3306
cp .env.example .env
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev             # portal :3001, brokerage :3002
```
- Dev admin: `/admin/login` → `admin@newobour.com` / `changeme123` (dev seed only).
- OTP codes print to the dev terminal (`SMS_PROVIDER=console`).
- Prisma 7 = pure-JS driver, no query engine binary → works on Windows ARM64.

## 🚨 Production deploy runbook (memorize the gotchas)

Server: `root@77.42.66.76` (AlmaLinux 9 + CWP), app at `/root/noc`, pm2 apps
`noc-portal` + `noc-brokerage`. SSH: key-only, `ssh noc` from the owner's PC.

```bash
ssh noc 'cd /root/noc && git checkout -- package-lock.json 2>/dev/null; \
  git pull --ff-only && npm install && npm run db:release && npm run build && pm2 reload all'
```

**Gotchas that have each burned a real deploy — check every one:**
1. **ALWAYS `git checkout -- package-lock.json` BEFORE pulling.** `npm install` on the server
   dirties it; a dirty tree makes `git pull --ff-only` abort — and the chained
   `&& build && reload` then runs on the STALE checkout and *reports success*.
   **After every deploy verify `git log --oneline -1` matches what you pushed.**
2. **File-mode diffs also abort the pull** (e.g. after `chmod +x` on a tracked script).
   `git config core.fileMode false` is now set on the server; keep it that way.
3. **`db:release` = migrate:deploy + generate. It NEVER seeds.** The marketplace seed once
   wiped the admin's attribute organization — seeds are create-only now and excluded from
   release. Do not "fix" this by adding the seed back.
4. **Migrations are hand-written SQL with PascalCase table names** — prod MySQL is
   case-SENSITIVE (dev Windows is not). `VARCHAR(191)`, `DATETIME(3)`, utf8mb4.
5. **Env changes (e.g. `NOC_SITE`) need `pm2 restart ecosystem.config.js --update-env`** —
   plain `pm2 reload all` does NOT re-read ecosystem env.
6. Building on the server takes ~1–2 min; a failed build leaves the old app running (safe).

## Production server map (what's configured and why)

- **Nginx** owns :80/:443 (Apache is broken/disabled on this box). Our vhosts:
  `/etc/nginx/conf.d/noc.conf` — mirrored in the repo at **`ops/nginx-noc.conf`** (keep in sync).
  **CWP gotcha:** always `listen 77.42.66.76:443 ssl` (specific IP) — a bare `listen 443`
  gets hijacked by CWP's wildcard default vhost.
- **TLS:** one Let's Encrypt SAN cert (`/etc/letsencrypt/live/newobour.com/`) covering
  newobour.com + www + alsawarey.com + www. **Renewal: `authenticator = webroot`
  (`/usr/local/apache/autossl_tmp`) — the certbot nginx authenticator does NOT work here.**
  The :80 vhosts serve `/.well-known/acme-challenge/` before redirecting. Renew hook reloads nginx.
- **Outbound mail:** Postfix → **Brevo relay** (`smtp-relay.brevo.com:587`). Both domains are
  Brevo-authenticated (SPF `include:spf.brevo.com` + brevo DKIM CNAMEs in Cloudflare DNS).
  DKIM signing also active locally (OpenDKIM). **Deliverability status: Gmail → inbox;
  Outlook/live.com → spam (shared-IP reputation; auth is verified correct — do not chase DNS).**
  A Postfix `transport_maps` rule DISCARDS mail to the placeholder `yourdomain.com` /
  `noc.yourdomain.com` (hourly cron mail used to hard-bounce via Brevo and hurt reputation).
- **DNS:** Cloudflare is authoritative for both domains but records are **DNS-only (grey)** —
  the proxy flip (Part C) is prepped and waiting on the owner: see `ops/CLOUDFLARE.md`.
  Server side (real-IP restore + CSF trusting CF ranges) is already live.
- **Crons** (`/etc/cron.d/`): `noc-backup` 02:30 (DB+uploads+.env, 14-day rotation) ·
  `noc-offsite` 03:30 (rsync push to owner's server — activates when configured) ·
  `noc-backup-alert` 04:00 (emails/SMSes owner if backups are stale) ·
  `noc-analytics-rollup` 03:05 · `noc-analytics-prune` 03:15 ·
  `noc-price-snapshot` 03:20 on the 1st (monthly per-district price capture → /price-index trend).
- **Backups admin UI:** `/admin/settings/backups` — status, per-file downloads, instant backup,
  integrity check, schedule/retention editors, off-site config + connection test, failure alerts
  (currently: aleimam@live.com + ebmta17@gmail.com + SMS 01225227677). **Restore stays CLI-only**
  by design (`ops/RESTORE.md`).
- **SSH safety:** `/root/.ssh/authorized_keys` is immutable (`chattr +i`) + fallback key file
  `/etc/ssh/root_keys` (CWP once wiped .ssh). Password auth off. Recovery: CWP panel :2087.

## Architecture rules (learned the hard way)

- **Shared-package client/server split:** in `packages/partner-portal` (and any future package),
  the barrel `index.ts` exports ONLY client-safe things ('use server' actions + client
  components). Anything importing Prisma goes under a **`/server` subpath** export. Importing
  Prisma via a barrel into a client bundle = `Can't resolve 'fs'/'tls'/'net'`.
  A type-only-Prisma module can get its own lightweight subpath (see `/visibility`).
- **Tailwind `@source`:** every new shared package with Tailwind classes MUST be added to
  BOTH apps' `app/globals.css` `@source` globs, or its classes silently purge (this broke the
  partner login layout once).
- **Route re-export pattern:** app routes can be one-liners re-exporting a shared server
  component: `export { X as default } from '@noc/partner-portal/server'; export const dynamic = 'force-dynamic';`
  (route-segment config must live in the route file, not the package).
- **`NOC_SITE` env** (`newobour` | `alsawarey`, set in `ecosystem.config.js`) is the
  server-trusted brand identity — `currentSite()` in @noc/auth gates partner logins per site.
- **Reverse-proxy redirect landmine:** behind nginx `req.url` is `http://localhost:PORT`. Never
  build absolute redirects from it — use `process.env.PORTAL_URL`/`BROKERAGE_URL`. (Auth.js is
  already pinned via AUTH_URL.) Relative `redirect()` from next/navigation is safe.
- **Standalone tsx scripts must NOT import the `@noc/auth` barrel** (it boots NextAuth).
  Import the specific module, e.g. `packages/auth/src/otp` (see `ops/backup-alert.ts`).
- **Listings are EAV:** `Listing` + `ListingValue` (typed columns per row) + a 3-classifier
  model (Type/Purpose/Condition) gating attribute applicability. Photos/papers ride the
  polymorphic `Attachment` (`ownerType`/`ownerId`/`attributeId`).
- **Owner display rule:** partners see UNBRANDED assets only; branded posters are per-brand
  (photo-stamping engine with per-category rules).
- **EAV SELECT read path:** since the 2026-07 option-lists migration, SELECT values are stored
  as `listItemId` (shared OptionList); legacy rows still carry `optionId`. ANY read of a SELECT
  value MUST fall back `listItem ?? option` — reading only `option` silently dropped city/district
  from every post-migration storefront card + search haystack (found & fixed in the 2026-07-12
  hardening pass; same trap existed in `similarLands`).
- **Public write endpoints get an in-app rate limit** (`lib/rateLimit.ts` per app: in-memory,
  X-Real-IP-trusting, size-capped). Convention from the hardening pass: page-render log writes
  ~20/min/IP (feature keeps working over the cap — only the WRITE stops), beacons ~60/min/IP,
  lead-style forms get per-IP + a global ceiling + dedupe + a honeypot field. Anything derived
  from unauthenticated writes (e.g. trending suggestions) must be windowed + cached + length-capped.

## Feature map (all live in production)

| Module | Where | Notes |
|---|---|---|
| Marketplace (listings) | portal `/market`, admin `/admin/marketplace` | EAV + classifiers + moderation queue (PENDING→PUBLISHED) |
| Al Sawarey storefront | brokerage `/` `/listings` | display-only; `showOnBrokerage` + Type/Purpose gates; customer OTP login, wishlist |
| **Partner portal (multi-site)** | `/partner` on BOTH domains | 100% shared via `@noc/partner-portal`; per-partner site access (`Owner.siteNewObour/siteAlsawary`); partner listings show only on enabled sites; lean listing form both sides; login = password OR OTP (SMS/email) |
| Rationing (كشوف التقنين) | portal `/rationing`, admin sheets/scans/**watchers** | Excel import, soft Arabic search, quotas by security level; name-watch follow-ups (`/admin/rationing/watchers`) → auto-alert + curated congrats SMS + phone-contact «Done» queue |
| Lands/geo explorer | portal `/explore` | city→district→neighborhood→block, masterplans, advantages, amenities. Neighborhood inherits district LOCATION map if it has none (explore only, never listings) |
| Calculator | portal `/calculator` | area + تصالح cost calc, admin-editable rates (transfer 180/م² since the Authority's 2026-07 cut); the listing form's «مستحقات جهاز المدينة» auto-fills from the same `reconcile()` (🧮 button, needs أصل المساحة + المساحة) |
| News / Guide / Price index / Owner profiles | portal | public surfaces |
| Web analytics | admin `/admin/analytics` | first-party: sessions, events, funnel, Web Vitals, cohorts, rollups, saved views |
| **Search Intelligence** | public search on market/storefront/rationing · admin `/admin/analytics/search` | every search logged to `SearchLog` (Arabic-normalized, zeroResult, usedFastSearch) + select/convert attribution via `/api/search-event` beacons (heuristic recency — no server session id). Dashboard (funnel, top/zero/converting terms, filter by window·site·surface, RBAC `analytics`) hosts the **synonym dictionary** (`SearchSynonym` groups expand query tokens: term AND kept, variants OR'd) and the **zero-result lead inbox** (`SearchLead` — leads carry a phone, so inbox + editors need `analytics:MANAGE`). Public extras: zero-result "leave your number" card (`ZeroResultLead` → rate-limited `/api/search-lead`) and autocomplete (`SearchAutocomplete` → `/api/search-suggest`: cached corpus of types + geo names, trending when empty; picked suggestion sets `fast=1` → `usedFastSearch`). ⚠️ `apps/{portal,brokerage}/lib/search.ts` are MIRRORS — keep identical |
| Backups | admin `/admin/settings/backups` | see server map above |
| Appearance/theming | admin settings | per-site colors/fonts via Setting `theme.<brand>` |
| Security posture | admin settings | `security.level` LIGHT/MEDIUM/HIGH gates scans/maps/quotas |

## Current state & pending (as of 2026-07-14)

**Owner-blocked (waiting on the owner, everything else is prepped):**
1. **Cloudflare proxy flip (Part C)** — pure dashboard task now; ordered checklist in
   `ops/CLOUDFLARE.md` (TLS-first, one zone at a time; www is proxy-safe since the SAN reissue).
2. **Off-site backup target** — enter host/user/port/path in `/admin/settings/backups` and add
   the shown VPS pubkey to the remote's authorized_keys, then Test. Cron already installed.
3. **Rotate the Brevo SMTP key** (it appeared in a chat once) — then update `/etc/postfix/sasl_passwd`
   (see `ops/mail-relay-brevo.sh`) and `postmap` + reload.
4. **Partner portal UI click-test** — backend pipeline fully verified by script; a human should
   log in once on each site, submit the lean form, confirm PENDING in moderation. A dedicated
   **test partner exists**: username `testpartner`, email `egyptvitaminsshare@gmail.com`, both
   sites enabled, all categories granted (password resettable from the owner's admin panel →
   Owners → the unified owner editor's partner card). **Delete this owner+user after testing.**
5. `/code-review ultra` — owner-triggered, billed; fold findings into `security.md` §7.
6. **Enable the Price Index module** (Settings → Modules → مؤشر الأسعار) when the owner wants
   `/price-index` public — the page + monthly snapshot cron are live but hidden by this toggle.

**2026-07-14: rationing name-watch admin + follow-up workflow (commits `7f9f49a`→`d99345f`,
deployed+verified).** The public «تنبيهني عند ظهور اسمي» requests (`RationingFollow` kind=WATCH)
now have a full admin surface at **`/admin/rationing/watchers`** (RBAC `sheets:VIEW`, card in the
rationing hub). Master list with status-filter chips (all / active / **ظهرت — للمتابعة** = matched
& not-contacted / **تم التواصل** = Done / closed) + **«فحص الكشوف الحالية الآن»** which matches
active watchers against EVERY imported sheet — not just a fresh batch — via a shared
`runWatcherMatch(batchId?)` core (closes the pre-existing-match gap: a name already in an older
sheet before the person subscribed is otherwise never caught). **Follow-up workflow** (owner chose
*keep auto-SMS + add manual*): the follow-up tab is a select-list (checkboxes) with bulk
**congratulations SMS** (`sendCongratsSms` — warmer than the auto-alert, skips phone-less, dedup) +
**mark contacted-by-phone** (`markContacted` → moves the row to the Done tab with who/when + undo).
Import now reports matches: preview stat «متابعات ستُطابق» (`countWatchMatches`) + commit toast
«وطابق N…». Schema `RationingFollow.congratsAt/contactedAt/contactedBy` (migration
`20260714120000_rationing_follow_followup`); `FollowupTable` client in `WatchersClient.tsx`.

  - **SMS delivery fix (same batch):** watch-follow SMS sends to `User.phone`. The follow page marks
    only a CUSTOMER session as "logged in", but `startFollow` treated ANY session as logged-in — so a
    watch created **while logged in as STAFF/admin** attached to the phone-less admin account and
    **silently discarded the typed phone** → nothing to send. Fixed: `startFollow` auto-attaches only
    for `session.user.type==='CUSTOMER'`; staff/no-session fall through to the typed-phone path. Also
    `runWatcherMatch`/`sendCongratsSms` now stamp `lastNotifiedAt`/`congratsAt` ONLY on a successful
    send (were set regardless → false "sent"). **SMS Misr re-verified healthy 2026-07-14** (provider
    smsmisr, `environment=1` LIVE, balance 12915, live diagnostic send → `code 1901`, delivered to
    01225227677). **Delivery is NOT broken at the provider — any "SMS didn't arrive" = a missing
    recipient phone, not the pipeline.** (Also: the 2 stale phone-less test watchers were deleted.)
  - **Also 2026-07-14:** duplicate neighborhoods within the same district are now blocked
    (`upsertNeighborhood` rejects a same-name sibling — Arabic OR English, case/space-insensitive —
    at both add entry points; commit `c67848f`), and a latent bug where the numbered-add derived
    `order` was discarded (saved `input.order ?? 0`) is fixed; `ops/backfill-neighborhood-order.ts`
    re-run on prod (2 rows corrected).

**2026-07-13: admin-workflow batch (commits `32c9194` → `4a77aa2`, all deployed+verified):**
Al Sawarey classifier trio (Type «أرض - تم التخصيص» / Purpose «عمارة سكني» / Condition «جاري
ترفيق الحي») now pre-selects when the brokerage channel is toggled ON on a FRESH staff form —
both entry points; resolved by stable option keys (`land_allocated`/`housing_building`/
`utility_ongoing`) via `loadAlsawareyDefaults()` in the account-listings catalog, so admin
renames don't break it. **Card Title RETIRED** (owner request): input + plumbing removed,
generated posters always use the listing title; `Listing.cardTitle` stays as a dormant column.
Neighborhoods admin list: **blocks column removed** (owner: blocks are just a number like plot
no., not geo units) and replaced by sortable map-coverage badges (🗺️ مخطط / 📍 موقع). **Fixed**:
the in-form masterplan annotator never appeared on `/admin/newobour/market/new` (the page didn't
pass `nbMasterplans` — the marketplace pages did). **حاسبة التصالح transfer fee cut per the
Authority (10%→5%)**: `transferRate` 330 → **180**/م² (150 نقل ملكية + 30 إداري; `transferFlat`
135.35 unchanged) in both the code default and the live prod Setting. **NEW: 🧮 auto-calc on
listings** — the «مستحقات جهاز المدينة» section has a button running the same `reconcile()` as
`/calculator` (live rates via `getCalculatorConfig()`, passed to `ListingForm` on all five portal
entry points); inputs are «أصل المساحة» + «المساحة» (actual — BOTH required, standard is never
derived; owner decision) and it fills `ownership_fees`/`remaining_fees`/`first|second|third_annual`
— editable after fill.

**2026-07-12: Search Intelligence COMPLETE (S1→S3c, all deployed+verified):** S1 logging + fuzzy
per-token Arabic matching · S2 select/convert beacons · S3a dashboard + rationing wired into the
unified log + storefront geo-haystack fix (cards now carry District/Neighborhood names — «الحى
العاشر» used to return 0 on Al Sawarey) · S3b admin synonym dictionary + query expansion ·
S3c zero-result lead capture (+ manager-only inbox) + autocomplete/trending on the market search,
Al Sawarey hero + header. Same day: numerical district/neighborhood ordering everywhere (+
`ops/backfill-neighborhood-order.ts`), staff land-plots admin UI removed (Land model + customer
My-Lands kept), city now a mandatory auto-selected basic detail on every listing
(`REQUIRED_LISTING_ATTR_KEYS` in @noc/config + `ops/city-mandatory.ts`, ran on prod), and photo
SEO enriched (alt text + upload filenames lead with city → district → neighborhood).

**2026-07-12 (end of day): polish + hardening pass (commit `7ade160`)** — 3 parallel reviews
(security / correctness / UX) over everything shipped that day → **22 verified fixes, all
deployed + live-verified**. Headliners: the EAV `listItem ?? option` read-path fix (see
Architecture rules — storefront cards/search/similar-lands had silently lost city+district on
every post-migration listing); required listing details now enforced SERVER-side (publish only —
drafts may stay incomplete); rate limits per the new convention (search-log write 20/min/IP,
`/api/search-event` 60/min/IP, `/api/search-lead` + global ceiling + 24h dedupe + honeypot +
required query); trending suggestions windowed 14d + cached 60s + display-capped; synonym
dictionary cached 60s; `SearchLog` pruned by the nightly `noc-analytics-prune` cron (≥365d kept);
bigram matching so multi-word synonym groups («الحي العاشر») actually trigger; the misleading
always-0% refinement KPI removed (sessionId is never server-readable). UX: explicit «بحث» text
buttons (were 🔍-only), Al Sawarey header search upgraded to the same autocomplete, 16px inputs
everywhere (iOS focus-zoom), ≥40px admin touch targets, «(مطلوب)» word markers on required fields.

**2026-07-11 sweep (see ROADMAP "Current status"):** full UI/UX review fixed+deployed (~80
findings incl. wa.me links via shared `waPhone()`, Toaster in both apps, partner photo-drop,
admin confirms/error surfacing, required rejection reason); Price Heatmap shipped
(`PriceSnapshot` + `noc-price-snapshot` cron, 1st @ 03:20); owner editor unified (atomic
`saveOwnerFull`; PartnerPortalPanel deleted); partner Browse scoped to Al Sawarey offers;
Al Sawarey footer name/slogan editable + Partners in header; geo explorer fully public.

**Known-good facts** (don't re-litigate): SMS Misr works; email-OTP works; both domains'
SPF/DKIM verified; cert renewal verified via dry-run; analytics crons verified; Phase-4 listing
visibility verified with a live truth-table; backups restore-tested.

## Doc index

- `README.md` — quickstart + stack
- `DEPLOY.md` — original server setup narrative (this file supersedes it where they differ)
- `ROADMAP.md` — feature scoping + status log
- `security.md` — security posture + hardening decisions
- `ops/README.md` — every server script + cron, indexed
- `ops/CLOUDFLARE.md` · `ops/OFFSITE.md` · `ops/RESTORE.md` · `ops/MAIL-DELIVERABILITY.md` ·
  `ops/HARDENING.md` — task runbooks
