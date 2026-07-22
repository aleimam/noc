# CLAUDE.md — NOC platform (read me first)

Master onboarding for anyone (human or Claude session) picking up this repo. It captures the
architecture, the production runbook, and every hard-won gotcha. Deeper docs are linked at the
bottom. Last full update: **2026-07-22**. Mid-flight state (if any) lives in `HANDOFF.md`.

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
- **DNS:** Cloudflare is authoritative for both domains and **both apexes are PROXIED (orange)
  since 2026-07-22** — WAF, Bot Fight Mode, rate limiting and hotlink protection are live; see
  `ops/CLOUDFLARE.md`. Real-IP restore (`CF-Connecting-IP`) + CSF trusting CF ranges are live, so
  nginx and the app's rate limiter still see true visitor IPs. **Never enable Rocket Loader**
  (breaks Next.js hydration) and **never "Cache Everything"** (would cache admin/logged-in HTML).
- **Crons** (`/etc/cron.d/`): `noc-backup` 02:30 (DB+uploads+.env, 5-day rotation) ·
  `noc-backup-alert` 04:00 (emails/SMSes owner if backups are stale) ·
  `noc-analytics-rollup` 03:05 · `noc-analytics-prune` 03:15 ·
  `noc-price-snapshot` 03:20 on the 1st (monthly per-district price capture → /price-index trend) ·
  `noc-purge-deleted` 03:40 (hard-deletes listings trashed >90 days — see soft delete rule below) ·
  `noc-backup-tick` every 10 min (tiered OFF-SITE backup; the app decides what's due).
- **Backups admin UI:** `/admin/settings/backups` — the LOCAL nightly backup section (status,
  per-file downloads, instant backup, integrity check, daily-time/retention editors, failure alerts
  — currently: aleimam@live.com + ebmta17@gmail.com + SMS 01225227677) followed by the TIERED
  OFF-SITE module's own section (`OffsiteTiers`: SFTP connection config + test, per-tier schedule/
  retention, run history). The old rsync off-site config panel was retired 2026-07-21 (off-site is
  now exclusively the tiered module). **Restore stays CLI-only** by design (`ops/RESTORE.md`).
- **TIERED off-site backup (2026-07-20, added ALONGSIDE the local nightly one — it does not
  replace it).** DB-driven: `BackupConfig` / `BackupTier` / `BackupRun`, logic + 24 vitest tests in
  `packages/backup`, SFTP via `ssh2-sftp-client` → Hetzner Storage Box **sub-account
  `u635384-sub6`, port 23** (NOT 22 — 22 answers but is chrooted and silently writes
  `/home/home/…`). **A sub-account sees its base dir as `/home`**, so folders are `/home/hourly`,
  `/home/daily`, `/home/weekly`, `/home/manual` — each level MUST keep its own folder or the two
  retentions prune each other. Archives are `noc-backup-<db|full>-<UTC stamp>.tar.gz` + a
  `manifest.json` stating what they ACTUALLY hold; the `noc-` prefix is what the pruner matches
  (shared storage with YeldnIN + veeey). MANUAL sits at `frequency=OFF` so ad-hoc runs never
  consume a scheduled retention slot. Password is AES-256-GCM at rest (HKDF from AUTH_SECRET) —
  re-enter it in the UI if AUTH_SECRET is ever rotated. **CSF `TCP_OUT`/`TCP6_OUT` must contain 23**
  (added 2026-07-20; backup of csf.conf at `/root/csf.conf.bak-*`). Full spec, incl. the gotchas
  that caused real outages: `C:ClaudeYeldnINBACKUP.md`. **Cadence: hourly (every 1h, DB-only,
  keep 24 = a full day) · daily + weekly full (keep 7/8) · MANUAL button-only (keep 10).** **VERIFIED
  2026-07-20:** a cron-fired SCHEDULED run succeeded (08:00:02, standalone tsx — the `server-only`
  trap that broke veeey does NOT apply here) and a full restore drill passed — 667MB archive
  byte-exact, manifest matched, restored into a scratch DB: 82 tables and all 12 business tables
  row-identical to live (RationingSheet 4862). NOT yet exercised: a retention prune deleting a
  real remote file (needs >keepLast archives to accumulate).
- **SSH safety:** `/root/.ssh/authorized_keys` is immutable (`chattr +i`) + fallback key file
  `/etc/ssh/root_keys` (CWP once wiped .ssh). Password auth off. Recovery: CWP panel :2087.
- **Attack surface (hardening round 3, 2026-07-11 — see `security.md` §5 + F9–F12):** public
  listeners are now ONLY web (80/443) · SSH 22 (key-only) · the mail stack · CWP panel
  2030–2096. **pure-ftpd and BIND/named were disabled+firewalled** (unused; FTP was under live
  brute-force; DNS is Cloudflare's) — if something "used to work over FTP", that's why.
  TLSv1.3 enabled, `server_tokens off`, `.env` 600. **Both Next apps bind 127.0.0.1 only**
  (`next start -H 127.0.0.1` in each app's `start` script — nginx proxies via localhost; don't
  "fix" this back to 0.0.0.0). Kernel rebooted onto 5.14.0-687.23.1. pm2 still runs as root
  (accepted trade-off on this CWP box).

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
- **Listing deletion is SOFT (2026-07-16):** `Listing.deletedAt` + 90-day trash. The central
  public gates `newObourVisibility()`/`alsawareyVisibility()` in
  `packages/partner-portal/src/visibility.ts` filter `deletedAt: null` — route any new public
  listing read through them; direct `prisma.listing` reads (admin lists, counts, sitemaps,
  aggregates) must add the filter themselves. Trash UI (admins only):
  `/admin/marketplace/listings/deleted` (restore / purge). Hard delete happens ONLY via
  `purgeListing` (refuses non-trashed ids) or the `noc-purge-deleted` cron
  (`ops/purge-deleted-listings.ts`) — the cleanup transaction (attachments incl. posters +
  listing-level area maps + row) is MIRRORED in both; change them together.
- **Card covers go through the thumbnail pipeline:** `/thumb/w{320|480|640|960}/<uploads-relpath>`
  routes exist in BOTH apps and are MIRRORS (like `lib/search.ts`) — sharp→WebP q72, disk cache
  under `<uploadRoot>/.thumbs/`, immutable cache headers, path-traversal + width + extension
  whitelists. Build card image URLs with each app's `thumbUrl()` helper (portal `lib/thumb.ts` +
  `lib/listingCovers.ts` coversForListings; brokerage `lib/thumb.ts` + `coversFor` in
  `lib/listings.ts`). Full-size originals stay for detail pages/lightbox.
- **Required listing details are ADMIN-CONFIGURABLE (2026-07-19):** `Attribute.required` is the
  source of truth (`REQUIRED_LISTING_ATTR_KEYS` = `['city']` remains only as a defensive
  fallback). Enforcement lives at FOUR sites that must stay in step — client full form
  (`apps/portal/app/account/listings/ListingForm.tsx`), client lean form
  (`packages/partner-portal/src/LeanListingForm.tsx`), and the two server saves
  (`apps/portal/app/account/listings/actions.ts`, `packages/partner-portal/src/listingSave.ts`).
  Invariants: only PENDING (publish) is blocked — DRAFTs may stay incomplete; only attributes
  APPLICABLE to the chosen Type/Purpose/Condition are demanded; a boolean `false` («لا» on YESNO)
  COUNTS as answered; **PHOTOS/DOCUMENTS can never be required** (their data rides Attachment rows
  the value checks can't see — forced off in `upsertAttribute`, skipped by `setSectionRequired`,
  hidden in the admin editor, filtered out in both server queries). Admin UI: ★ per-attribute
  checkbox + per-section bulk buttons at `/admin/marketplace/attributes`.

## Feature map (all live in production)

| Module | Where | Notes |
|---|---|---|
| Marketplace (listings) | portal `/market`, admin `/admin/marketplace` | EAV + classifiers + moderation queue (PENDING→PUBLISHED); auto-save-as-draft while writing (create-once-update-after, 15s interval, only for new/DRAFT); soft delete → 90-day trash (see Architecture rules). **Form layout (owner-set 2026-07-17, don't reshuffle):** types → category details (inside معلومات اساسية — the «تفاصيل إضافية» heading is retired; the 🗺️ location-map annotator renders INSIDE this run, directly below whichever group holds the neighborhood picker — detected by attr type NEIGHBORHOOD) → title → price row [السعر · السعر لـ · 🔒 أقل سعر] then [ملاحظة · قابل للتفاوض؟] → partnerships → 🗂️ papers → 📞 contact → «تفاصيل أخرى + صور أخرى» (collapsed by default; contents mount only when open; header shows «يوجد محتوى» + photo count) → save actions (full-width on mobile). Keep papers + contact as the closing blocks; nothing goes between them and the actions except the collapsed extras. **Poster layout (owner's numbered mock 2026-07-17, `lib/poster/render.ts`):** the big poster's card grid is ROW-major with **city/district map in SLOT 1 (top-left)**, then the detail groups in a FIXED order keyed to STABLE section keys (owner mock 2026-07-18, `POSTER_CARD_ORDER` in `lib/poster/generate.ts`): `location-pros` → `auth_pay` → `location`, i.e. map · مميزات الموقع · مستحقات · الموقع = cells 1 TL, 2 TR, 3 BL, 4 BR (sections outside the list keep their section order after; ordered by KEY not the Arabic heading, which admins rename); the footer WhatsApp icon is the real WhatsApp mark; the advantages image (مميزات المنطقة) is frameless with a 2-line capped title, measured divider, content-adaptive height, and rows that word-wrap to a 2nd line (ellipsis only past two lines); the header title is width-capped (shrink-to-fit floor 20px, then ellipsis) so it can never overprint the رقم الإعلان pill / area table. **Header layout is admin-switchable per brand** (Settings → هوية الصور المولّدة → «تخطيط رأس البوستر», Setting `posterTheme.<brand>.headerLayout`): `side` (code default — compact, table beside the title) or `row` (info table as one full-width 6-cell strip BELOW the band; title gets the whole line — best for long titles). **BOTH brands are set to `row` since 2026-07-17 (owner choice, both live-verified)** — don't "reset" the Setting to default. Saving flags published listings postersStale |
| Listing hero gallery | listing detail pages, BOTH sites | ecommerce-style `HeroGallery`+`Lightbox` in @noc/ui: order = location map → big branded poster → photos → generated → area photos/maps (nb-masterplan skipped when the location map exists); autoplay 4s stop-on-touch (+reduced-motion/hidden-tab/off-screen guards); fullscreen zoom/copy/share/download/open-tab. First-party photo analytics (photo_open/nav/action → AnalyticsEvent, «أكثر الصور مشاهدة» card in the dashboard) — admin toggle Setting `gallery.photoAnalytics` (≠'0'=on). The «اسأل عن هذه الصورة» WhatsApp button was REMOVED entirely 2026-07-17 (owner request) — don't re-add |
| Al Sawarey storefront | brokerage `/` `/listings` | display-only; `showOnBrokerage` + Type/Purpose gates; customer OTP login, wishlist |
| **Partner portal (multi-site)** | `/partner` on BOTH domains | 100% shared via `@noc/partner-portal`; per-partner site access (`Owner.siteNewObour/siteAlsawary`) gates **login only** — **a partner's listings show on BOTH public sites regardless of site-access (owner decision 2026-07-18; editing from portal or admin is global, one shared Listing row)**; only Al Sawarey's `showOnBrokerage` (non-partner listings) + Type/Purpose `allowedOnAlsawarey` still gate the storefront. Nav tabs now render from ONE shared client component `PartnerNav` (@noc/partner-portal) so they can't drift — it also highlights the ACTIVE tab (`/partner` matches EXACTLY; every other href starts with it). Tabs: **إعلاناتي** (own listings, editable = dashboard; every PUBLISHED row carries ✎ تعديل + a «🛒 عرض في السوق» button opening that listing's public page in a new tab — suppressed on alsawarey for rows whose Type/Purpose isn't `allowedOnAlsawarey`, since the storefront detail page would 404) · **الصواري** (renamed from «عروض الصواري» 2026-07-22) = view-only browse of **OUR OWN inventory: `Owner.type = US`**. ⚠️ It previously filtered on `alsawareyVisibility()` alone, which admits ANY partner-owned listing — so a partner saw their own 12, another partner's 4, and only 3 real ones (a cross-partner leak). The owner-type gate is the real filter. **Fast-edit row controls are TWO SWITCHES, and one sentence governs both (owner decision 2026-07-22, do NOT re-litigate): green + knob RIGHT = the listing is live and sellable.** الحالة: متاح(on)⇄تم البيع(off) · الظهور: ظاهر(on)⇄مخفي(off). Grey is used for BOTH off-states — the owner chose one consistent rule over colour-coding «sold» differently. The track is `dir="ltr"` ON PURPOSE (no RTL mirroring) so the control moves the same physical way in Arabic and English; state is also spelled out in words. ARCHIVED can't remember "was sold" (one `status` column), so un-hiding returns to متاح and the الحالة switch is disabled while hidden. Lean listing form both sides; login = password OR OTP (SMS/email); account page has an eye-toggle password field (can't show the stored hash) |
| Rationing (كشوف التقنين) | portal `/rationing`, admin sheets/scans/**watchers** | Excel import, soft Arabic search, quotas by security level; name-watch follow-ups (`/admin/rationing/watchers`) → auto-alert + curated congrats SMS + phone-contact «Done» queue; scans page = full photo↔rows reconciliation suite (clickable orphan/missing/serial-gap drill-downs, one-click filename fixes, per-import coverage) |
| Lands/geo explorer | portal `/explore` | city→district→neighborhood→block, masterplans, advantages, amenities. Neighborhood inherits district LOCATION map if it has none (explore only, never listings) |
| Calculator | portal `/calculator` | area + تصالح cost calc, admin-editable rates (transfer 180/م² since the Authority's 2026-07 cut); the listing form's «مستحقات جهاز المدينة» auto-fills from the same `reconcile()` (🧮 button, needs أصل المساحة + المساحة) |
| News / Guide / Price index / Owner profiles | portal | public surfaces |
| Web analytics | admin `/admin/analytics` | first-party: sessions, events, funnel, Web Vitals, cohorts, rollups, saved views |
| **Search Intelligence** | public search on market/storefront/rationing · admin `/admin/analytics/search` | every search logged to `SearchLog` (Arabic-normalized, zeroResult, usedFastSearch) + select/convert attribution via `/api/search-event` beacons (heuristic recency — no server session id). Dashboard (funnel, top/zero/converting terms, filter by window·site·surface, RBAC `analytics`) hosts the **synonym dictionary** (`SearchSynonym` groups expand query tokens: term AND kept, variants OR'd) and the **zero-result lead inbox** (`SearchLead` — leads carry a phone, so inbox + editors need `analytics:MANAGE`). Public extras: zero-result "leave your number" card (`ZeroResultLead` → rate-limited `/api/search-lead`) and autocomplete (`SearchAutocomplete` → `/api/search-suggest`: cached corpus of types + geo names, trending when empty; picked suggestion sets `fast=1` → `usedFastSearch`). ⚠️ `apps/{portal,brokerage}/lib/search.ts` are MIRRORS — keep identical |
| Backups | admin `/admin/settings/backups` | see server map above |
| Appearance/theming | admin settings | per-site colors/fonts via Setting `theme.<brand>` |
| Security posture | admin settings | `security.level` LIGHT/MEDIUM/HIGH gates scans/maps/quotas |

## Current state & pending (as of 2026-07-22)

**Everything below is deployed + live-verified; the tree is clean; local `main` = prod (`07cbe4c`).**

**2026-07-22 — BIG DAY (27 commits). Four things changed the shape of the system:**
1. **⭐ The Codex audit is CLOSED** — all 20 remaining findings worked (see the audit block below
   for the per-finding table and the two FALSE POSITIVES never to re-report).
2. **⭐ Cloudflare is LIVE in front of both domains** (Part C flipped + settings pass). Real
   visitor IPs still reach nginx, cert renewal survives the proxy, hotlink protection allows
   no-referer so WhatsApp/OG previews still work. **Never enable Rocket Loader or "Cache
   Everything".** Full detail + the verification evidence in `ops/CLOUDFLARE.md`.
3. **⭐ The leaked Brevo SMTP key is retired** — relay now authenticates as
   `b19e6d001@smtp-brevo.com`. ⚠️ **That account has an Authorised-IPs allowlist with
   `77.42.66.76` on it — if the server IP ever changes, ALL mail dies with `525 5.7.1
   Unauthorized IP address` until the new IP is added in Brevo.** `ops/mail-relay-brevo.sh`
   gained `verify`/`rotate`/`rollback`, and **`rotate` now authenticates BEFORE writing** (the
   old write-then-test order silently deferred live mail twice while we were rotating).
   **OWNER STILL TO DO: revoke the OLD key in the Brevo dashboard** — it remains valid until then.
4. **Partner portal click-tested by the owner and fixed** (see the Feature-map row): the
   «الصواري» tab was leaking OTHER partners' listings, the active tab wasn't highlighted, and the
   three status buttons became two switches under one rule — *green + right = live and sellable*.
   Hiding now REMEMBERS «تم البيع» (`Listing.statusBeforeHide`, migration
   `20260722140000_listing_status_before_hide`), with the transition matrix as a pure
   unit-tested function (`packages/partner-portal/src/availability.ts`, 10 vitest cases).

GSC check-up also run: **alsawarey's sitemap moved "Couldn't fetch" → Success** (read Jul 22,
i.e. after the Cloudflare flip); page-indexing coverage on both properties still says
"Processing data" — re-check in a few days. A full production sweep at the end of the day was
clean: both apps online, no 5xx, disk 31%, all 7 crons present, local backup current, off-site
hourly runs SUCCESS. The only app error all day was a single 29-request scanner burst at 03:04
(malformed Server Action probes) — pre-Cloudflare, never repeated.

**2026-07-20 (last): CODEX AUDIT PASS 1 — all 7 defects + 7 extras fixed** (commits `06e58e5`→
`baf90b1`, all deployed + live-verified). Codex ran pass 1 of `CODEX_AUDIT_BRIEF.md` (listings +
EAV) and produced `CODEX_AUDIT_FINDINGS.md`; every finding was independently re-verified against
the code AND against production data before being touched. Resolution table lives in that file —
**a later Codex pass must not re-report these.** Headlines:
- **⭐ Market SELECT filters returned ZERO results for the entire live inventory** — `/market`
  matched only the legacy `optionId`, but prod has 45 `listItemId` values and **0** legacy rows, so
  ticking any facet hid all 6 published listings while the chips still rendered. The `listItem ??
  option` rule now applies to FILTERS too (both apps). This is the same trap CLAUDE.md already
  warned about on read paths — **check it on any new query that touches a SELECT value.**
- **The admin archive toggle was a lifecycle shortcut, not a visibility switch:** two clicks could
  republish a REJECTED or SOLD listing, or take a DRAFT live past moderation + required-details +
  poster generation. Now strictly PUBLISHED ↔ ARCHIVED (server-enforced, UI-hidden otherwise), and
  archiving no longer clears `showOnBrokerage` (status already gates the storefront; nothing
  restored it, so an archive round-trip silently dropped the listing from alsawarey.com).
- **`user.type === 'STAFF'` was a blanket ownership bypass** in `saveListing`/`setMyListingStatus`,
  and `/account/listings/<id>/edit` never loaded paper state — so a staff save there cleared both
  paper flags and detached the paper photos. Staff writes to a listing they don't own now require
  the `listings` grant; omitted paper fields mean "leave unchanged"; that route is seller-only.
- **TWO new shared modules** — `@noc/partner-portal/required` (one required-details gate, now run on
  EVERY transition to PENDING/PUBLISHED incl. approve + reactivate + forged status change) and
  `@noc/partner-portal/values` (`normalizeListingValues` forces each value into the column its
  attribute type allows and keeps only option ids that attribute owns; `validateClassifierTrio`
  checks classifier identity + Type→Purpose→Condition nesting). **Any new listing write path should
  go through both.**
- **`parsePriceInput()`/`isStoredPrice()` in @noc/config are now the ONE money rule**: 0/blank ⇒
  null («السعر عند الطلب»), negative/non-finite ⇒ a validation error. The full-form save had no
  price validation at all. One live listing has `price=0` and was rendering **«0 ج.م» on the public
  home page and in the meta/OG description** (i.e. in Google results and WhatsApp shares).
- Also: `soldPrice` normalized + cleared when a listing leaves SOLD (a stale figure used to
  resurface as the next sale price) · `/price-index` medians no longer fed by 0/negative prices ·
  auto-save races closed (duplicate create + silent DRAFT demotion from a stale second tab) ·
  Section 2 UX: visible auto-save FAILURE with a Retry button, moderation queue names each pending
  row's missing details and disables Approve, price field explains the blank/zero rule, and
  `ListingCard` says «السعر عند الطلب» instead of leaving a blank price slot.

**2026-07-20 (later): TIERED OFF-SITE BACKUP MODULE** (commits `283c112`→`5319587`) — full detail
in the server map above. Built from the portable spec `C:\Claude\YeldnIN\BACKUP.md` as an ADDITION
to the local nightly backup (which is untouched). Highlights: 3 tables + 4 seeded levels, pure logic
with **24 vitest tests** (NOC had no test runner before this), SFTP transport, AES-256-GCM secret,
manifest-bearing archives, every-10-min cron. **Verified, not assumed:** a cron-fired SCHEDULED run
succeeded and a full restore drill passed into a scratch DB with all 12 business tables row-identical
to live. Two bugs were caught by verification rather than by tests: `.env` was silently dropped from
every archive (`fs.cp`'s `mode` is a COPYFILE_* flag, not a permission — the catch-all hid it), and
the hourly label said «كل ساعتين» while `everyN` was 1. Both fixed. **Not yet exercised:** a
retention prune deleting a real remote file.

**2026-07-19→20: required-details / global-UX / hardening batch (commits `2356b26`→`e395a3d`,
all deployed + live-verified).**
- **⭐ Admin-configurable REQUIRED listing details** (migration `20260719120000_attribute_required`):
  `Attribute.required` per attribute + per-section bulk buttons at `/admin/marketplace/attributes`;
  ★ + «(مطلوب)» on both listing forms; publishing blocked with red highlight + scroll-to-first when
  a required applicable detail is empty. Full invariant list in Architecture rules — **the four
  enforcement sites must stay in step.** Owner's live settings (7 required): المساحة · المدينة ·
  5 of 6 مستحقات جهاز المدينة (the generic «القسط السنوي» is deliberately optional); أصل المساحة and
  all مميزات الموقع optional. Existing published listings are NOT retroactively affected.
- **Global RTL placeholders**: one CSS rule per app (`[dir='rtl'] input:not([type='url'])::placeholder`)
  fixes Arabic hints inside deliberately `dir="ltr"` fields (phone/email/password) system-wide —
  no per-field patching needed for future inputs. URL inputs excluded (bidi reordered `https://`).
- **`PasswordInput` in @noc/ui — the house standard for EVERY password box** (👁/🙈, ≥40px target,
  locale-aware aria): partner login (both sites), admin login, admin change-password (×2), staff
  manager, SMS-provider password, partner account. Add new password fields with this component.
- **Partner portal**: «🛒 عرض في السوق» per published row (see Feature map); tabs unified to
  **إعلاناتي** across both apps (the brokerage still had the old «لوحتي / تصفّح العروض» labels).
- **07-20 polish+harden pass** (self-review + independent agent over the whole batch, 6 verified
  fixes): PHOTOS/DOCUMENTS can never be required (would have soft-locked publishing — exempted at
  all six layers); boolean `false` («لا» on YESNO) counts as answered; «عرض في السوق» hidden on
  ineligible alsawarey rows; bulk toggle surfaces failures; URL-placeholder bidi fix; eye-label
  locale. Then a **production sweep** (pm2 + nginx logs, cron/backup health, 18-URL crawl, browser
  consoles): one real defect found and fixed — the `favicon.ico` routes were static, so Next kept
  trying to prerender-cache a body-less 308 and logged `LRUCache: calculateSize returned 0` on both
  sites; now `force-dynamic`. Everything else clean (no 5xx, backups current, rollup fresh).
  Note: `/news` + `/guide` 404 by DESIGN — those modules are toggled off in Settings → Modules.
- **`AGENTS.md` added** at the repo root — onboarding pointer for non-Claude agents (Codex reads
  it by convention); it points at CLAUDE.md and lists the house invariants.

**2026-07-18→19: listings/poster/partner batch (commits `a207826`→`751c5cd`, all deployed + live-verified).**
- **Poster big-card grid order** finalised to a FIXED order keyed to STABLE section keys
  (`POSTER_CARD_ORDER` in `lib/poster/generate.ts`): `location-pros → auth_pay → location`, row-major =
  map · مميزات الموقع · مستحقات · الموقع (cells 1 TL, 2 TR, 3 BL, 4 BR). Owner iterated on this a few
  times — this is the final; don't reshuffle. (Reorder happens in generate.ts by section KEY; render.ts
  is unchanged row-major, map in slot 1.)
- **0/blank price ⇒ «السعر عند الطلب / تواصل لمعرفة السعر»** everywhere public (brokerage card+detail
  builders normalise 0⇒null; portal market card/detail/compare/similar + structured-data Offer guard
  `> 0`). See the Feature-map thumbnail row.
- **Card covers gained a neighborhood-masterplan fallback** (`coversFor`/`coversForListings`, both
  mirrors) → a new listing with no drawn location map AND no photos still shows its area map, never a
  blank card.
- **⭐ Partner listing-visibility DECOUPLED from site-access (owner decision):** `Owner.siteNewObour`/
  `siteAlsawary` now gate partner **login only** — a partner's listings show on **BOTH** public sites
  regardless (editing from portal or admin is global, one shared `Listing` row). `newObourVisibility()`
  ⇒ `{deletedAt:null}`; `alsawareyVisibility()` ⇒ any partner-owned OR `showOnBrokerage`;
  `listingVisibleOnNewObour()` ⇒ `true` (see `packages/partner-portal/src/visibility.ts`). **This
  SUPERSEDES the earlier "partner listings only on enabled sites" rule** — don't reinstate it. (Concrete
  effect: owner «عقيد إسلام البربري» / partner `elbarbary` is Al-Sawarey-login-only but his 3 listings
  now show on both sites; New Obour `/market` went 3→6.)
- **Partner portal nav** split/renamed: **عروضي** (own listings, editable = the dashboard) · **عروض
  الصواري** (view-only browse of every Al Sawarey offer, no editing). Account page got a reveal-password
  (👁) toggle on the new-password field (can't show the stored hash — it's encrypted).
- **Admin label «البائع» → «أضيف بواسطة» / "Posted by"** (the `seller` i18n key) — it's the account that
  posted the listing (staff), distinct from the recorded «المالك» (real owner, internal contact).
- **«شوهدت مؤخرًا» auto-prunes deleted listings:** `RecentlyViewed` (@noc/ui) validates its localStorage
  snapshot against the new **mirrored** route `POST /api/listings/alive` (both apps; returns ids still
  PUBLISHED/SOLD & not soft-deleted, 60/min/IP) on mount, drops dead entries, renders nothing until
  validated. Fixed the "blank اختبار SEO cards" the owner saw.
- **Data cleanup:** deleted one ORPHANED neighborhood-masterplan `areaMap` (row + 3 image files) that
  pointed to a deleted neighborhood; verified (md5 + 32×32 perceptual diff) all 24 live neighborhood
  masterplans are otherwise distinct — no neighborhood shares another's map. Listing **#2607501** still
  has **no drawn location map** (owner must draw it via admin Edit → ✎ «إنشاء خريطة الموقع من مخطط الأصل»
  if they want the big annotated map on its poster; the card thumbnail is covered by the masterplan
  fallback regardless). An optional `ops/find-orphan-maps.ts` sweeper was offered but **not built**
  (zero orphans remain).

**2026-07-20 polish+harden pass over the 07-19→20 batch (self-review + independent agent, 6
verified fixes):** required-attribute enforcement now EXEMPTS PHOTOS/DOCUMENTS at all six layers
(their data rides Attachment rows the value checks can't see — a required one would have
soft-locked publishing; admin UI hides the ★ checkbox for file types, `upsertAttribute` +
`setSectionRequired` force/skip them); boolean `false` («لا» on YESNO) now counts as answered in
both client forms (was client-blocked, server-accepted); «عرض في السوق» hides on alsawarey rows
whose Type/Purpose isn't `allowedOnAlsawarey` (detail page would 404); the bulk required toggle
surfaces failures via toast; the RTL-placeholder CSS excludes `input[type=url]` (bidi reordered
`https://`); PasswordInput's eye label follows the UI locale at every call site.

**Owner-blocked (waiting on the owner, everything else is prepped):**
1. ~~**Cloudflare proxy flip (Part C)**~~ **✅ DONE + verified 2026-07-22.** Both apexes are
   orange-clouded on **Full (strict)**, with the settings pass applied (Always-Use-HTTPS, HTTP/3,
   Bot Fight Mode, Security Medium, Managed Ruleset, one rate-limit rule per zone, hotlink
   protection; **Rocket Loader OFF**). Proven, not assumed: real visitor IP reaches nginx through
   the edge; ACME renewal still served through the proxy; hydration works in a real browser;
   hotlink allows no-referer (WhatsApp/OG previews safe) and blocks foreign referers;
   `cf-cache-status: DYNAMIC` so no logged-in HTML is cached. Rollback = grey-cloud, one click.
   Optional leftover: **B3** (restrict :80/:443 to Cloudflare ranges) after a soak period.
2. ~~Off-site backup target~~ **✅ DONE + fully proven 2026-07-21** — the tiered SFTP module is live
   on Hetzner sub-account `u635384-sub6`; scheduled runs fire, a restore drill passed, and the
   **first retention prune ran + was verified 2026-07-21 07:00 UTC**: it deleted exactly the oldest
   hourly (`noc-backup-db-20260720-080002.tar.gz`) and `/home/hourly` now holds exactly 24, all
   `noc-backup-` (remote listing confirmed; NOC's sub-account is isolated so no other app's files
   are even visible, and the `noc-` prefix guard is belt-and-suspenders on top). **✅ OLD off-site
   rsync RETIRED 2026-07-21** (owner chose "off-site rsync only"): deleted `ops/offsite-backup.sh`,
   `ops/offsite.env.example`, `ops/OFFSITE.md`, the `noc-offsite` cron, and the off-site config/test
   panel + its server actions from the Backups admin. The LOCAL nightly backup (`ops/backup.sh`,
   `noc-backup` cron, staleness alerts, download/restore) is deliberately KEPT as the on-box safety
   layer. (The SFTP host key is pinned + verified — see the Codex-audit note below.)
3. ~~**Rotate the Brevo SMTP key**~~ **✅ DONE + verified 2026-07-22.** The leaked key is retired.
   Relay now authenticates as **`b19e6d001@smtp-brevo.com`** (the account's CURRENT SMTP login —
   the server had been holding an older one, `b17e37001`, which still worked). Proven by a real
   send: DKIM-signed `s=default, d=newobour.com` → `status=sent (250 2.0.0 OK: queued)`. All
   `sasl_passwd.bak-*` files were `shred -u`'d, so the old secret is off disk; `sasl_passwd` is
   600 root. **Owner still to do: revoke the OLD key in the Brevo dashboard.**
   - **⚠️ That account has Brevo's Authorised-IPs allowlist ON.** `77.42.66.76` is allowlisted
     (verified as the source IP Brevo actually sees — the box has IPv6 egress too, but
     `smtp-relay.brevo.com` publishes no AAAA, so SMTP is always IPv4). **If the server IP ever
     changes, mail dies with `525 5.7.1 Unauthorized IP address` — add the new IP there first.**
   - `ops/mail-relay-brevo.sh` gained `verify` / `rotate` / `rollback`. **`rotate` authenticates
     BEFORE writing** and reads the key from STDIN (never argv, never shell history). Use it for
     any future rotation — a rejected key changes nothing instead of silently deferring mail.
4. **Partner portal UI click-test** — backend pipeline fully verified by script; a human should
   log in once on each site, submit the lean form, confirm PENDING in moderation. The old
   `testpartner` account was **deleted from prod 2026-07-20** (it was an orphan PARTNER login:
   `User.ownerId` was NULL, so it had no owner/grants and could not actually post — the test was
   never completeable through it). To do this test now, create a FRESH partner properly (admin →
   Owners → add owner → its partner card: set a login + enable both sites + grant categories),
   run the test, then delete that owner+user.
5. `/code-review ultra` — owner-triggered, billed; fold findings into `security.md` §7.
6. **Enable the Price Index module** (Settings → Modules → مؤشر الأسعار) when the owner wants
   `/price-index` public — the page + monthly snapshot cron are live but hidden by this toggle.
7. **English content entry (owner paused 2026-07-16 — "later"):** alsawarey.com EN pages fall
   back to Arabic where admin EN fields are empty — biggest gaps: the whole `/sell` page content
   + storefront hero title/subtitle (Admin → Storefront editor). Same visit: upload a hero image
   (improves homepage + OG share preview, which falls back to the logo today). Pure content entry.
8. **GSC check-up — ✅ RUN 2026-07-22 (in the owner's Chrome).** Both properties stay HTML-tag
   verified (tokens in Settings `gsc_newobour`/`gsc_alsawarey` render as meta tags — confirmed
   still present through Cloudflare; **never delete them**, verification depends on them).
   - **⭐ alsawarey sitemap moved "Couldn't fetch" → `Success`**, last read **Jul 22** — i.e. Google
     fetched it fine AFTER the Cloudflare flip. newobour sitemap also `Success` (read Jul 19).
   - **Crawl surface verified healthy through the edge:** Googlebot UA gets 200 on `/`,
     `/robots.txt`, `/sitemap.xml` on both zones (Bot Fight Mode is NOT challenging crawlers),
     robots allows content while blocking `/admin` `/account` `/api`, and **all 22 alsawarey
     sitemap URLs return 200**.
   - **GSC's "discovered pages" lags the live sitemap** (81 vs 95 on newobour, 9 vs 22 on
     alsawarey) — expected, the sitemaps grew as listings were published; not a defect.
   - **Still pending:** Page-indexing coverage reads "Processing data, check again in a day or so"
     on BOTH properties (they're only ~6 days old). Performance so far: 2 total clicks on
     newobour. **Re-check coverage in a few days** — that's the only outstanding piece.

**Verification pending (needs a staff/admin login — I can't from a shell; everything else this
session is backed by real command output). These are reasoned + typechecked + built, deployed, but
NOT click-tested — confirm them in one admin session when convenient:**
- (a) the admin archive toggle now shows ONLY on PUBLISHED/ARCHIVED rows (`/admin/marketplace/listings`);
- (b) Approve is disabled with the missing details named when a pending row is incomplete;
- (c) the listing form's auto-save shows a red «لم يتم الحفظ» panel + Retry button on failure;
- (d) the per-row 🖼️ poster / 🗺️ map quick-links (commit `17a68a3` — partner «إعلاناتي» → UNBRANDED
  poster + clean map; admin recent list → New Obour-branded; each hidden when the asset doesn't exist;
  shared resolver `@noc/partner-portal/assets`). Asset URLs already confirmed serving 200 image/png —
  only the rendered rows are unconfirmed;
- (e) missing-required-field highlighting on BOTH listing forms (commit `b21395e` — the 5 basic fields
  Type/Purpose/Condition/Title/Phone now get the same red ring + inline «هذا الحقل مطلوب» note the
  catalog details already had, all missing fields named at once, scroll-to-topmost; partner lean form
  is now `noValidate` so the Arabic red note replaces the browser's English bubble). Verify by hitting
  Publish with a couple of fields blank.
- (f) one-click ✓ approve on the New Obour market list (commit `7ea6139`, `/admin/newobour/market`) —
  a green ✓ اعتماد on قيد-المراجعة rows only; reuses `approveListing` so the required-details gate
  still applies (names what's missing in the toast). Verify by approving a pending row.
- The map annotator (Brave banner + UUID ids) is separately click-verified in Chrome (Konva 9.3.22),
  so it is NOT in this list. The alsawarey footer redesign (Option B, commit `5c81238`) is a public
  page — content confirmed live via page text; a visual glance is enough (no login needed).

(Same admin login also covers the partner UI click-test, owner-blocked item 4 — create a fresh test
partner first, since `testpartner` was deleted.)

**Codex deep audit — ✅ ALL 16 PASSES RUN AND TRIAGED (see `CODEX_AUDIT_FINDINGS.md`).**
Pass 1 was fixed earlier (`06e58e5`→`baf90b1`). **Passes 2–16 were triaged, fixed, deployed and
live-verified 2026-07-22** in nine commits: `5baefe3` · `f7b0557` · `db1355e` · `8f1885b` ·
`0cbcdea` · `c6c7e81` · `0ee4ff8` · `39fe5d6` · `6ecf79c`. Full resolution table (wave → commit →
headline) at the top of the findings file — **a later pass must not re-report any of it.**
- **Method that must be repeated:** re-verify EVERY finding against CURRENT code before acting.
  That filtering caught **8 already-fixed**, **2 deliberate**, **1 moot**, and **1 outright WRONG**
  finding — acting on the last would have broken a working feature.
- **⚠️ Do NOT add a UNIQUE index on `RationingSheet.dedupeKey`** (the audit asks for it). Prod has
  4862 sheets / 4501 distinct keys = 361 duplicates, so it cannot apply — and
  `/admin/rationing/duplicates` is a BUILT FEATURE that groups by that key with a review workflow.
  `dedupeKey` is a GROUPING key, not an identity key. Only the atomicity half was taken, and
  per-ROW (a batch-wide transaction over ~4.8k rows would exceed Prisma's timeout and hold locks,
  turning a recoverable partial import into a guaranteed failure).
- **Biggest things this closed:** backup DB dumps were downloadable with read-only `settings:VIEW`;
  **revocation did not work at all** (disabling staff / revoking a partner site had no effect until
  token expiry — `requirePermission`/`requirePartner`/`getAdminViewer` now re-read the DB);
  `upsertStaff` allowed self-assigning SUPER_ADMIN; the analytics collector took its BRAND from the
  payload (cross-brand pollution — fix verified on prod with a forged beacon); a FULL backup whose
  uploads copy failed was recorded SUCCESS; `RESTORE.md` didn't describe the off-site archive;
  trashed listings still emitted their old title/OG image as page metadata; five public write
  endpoints had no quota; dropped OTP requests left the login button spinning forever.
- **Owner decisions taken 2026-07-22 — do not re-litigate:**
  - **ADMIN-EN-COVERAGE → DEFERRED (won't-do for now).** Owner: "we run the admin in Arabic most of
    the time and we can translate; if it requires big effort, ignore it." It IS big (~200 files plus
    a lint rule to stop the drift). Parked by name in the waiting list — do NOT start it
    opportunistically or "while nearby".
  - **Watermark reversibility → CONFIRMED A HARD RULE:** "the watermark system should be reversible
    all the time." Pure originals (`Attachment.originalPath`) and a map's `cleanPath` are **NEVER**
    deleted. Superseded STAMPED renditions ARE now unlinked (`b993c7d`) — safe because
    `revertCategory()` restores `path` from `originalPath` (maps from `cleanPath`) and never reads a
    previous stamp, so a re-stamp regenerates it from the untouched original. **Any future code that
    writes a new rendition must call `unlinkSupersededStamp()` in `lib/stamp.ts`** — it refuses to
    delete the original, anything not actually superseded, or anything outside `/uploads`.
- **✅ ALL 20 REMAINING ITEMS WORKED 2026-07-22** in four commits — `032d831` (operational) ·
  `01dd1d0` (security + UX) · `3ae36ea` (perf/hygiene, +migration) · `d3011de` (P0 identifier
  verification). All deployed; server HEAD verified `d3011de`; both sites 200; prod index confirmed.
  (An earlier revision of this file claimed "3 open" — that was WRONG: waves had been marked done on
  their headline items. **Reconcile per FINDING, not per wave.**)
  - **Fixed (18):** ① OwnerEditor site-access copy now says login-only · ② brokerage home counts use
    `STOREFRONT_STATUS` · ③ OTP bodies carry the right brand (`OtpBrand`, default `newobour`; the
    three brokerage routes pass `alsawarey`) + the portal partner route stopped hard-coding `'ar'` ·
    **④ partner email/phone changes now require an OTP to the NEW destination** (`partnerUpdateAccount`
    handles username+password ONLY; request/confirm/clear actions added; no path can leave the account
    with zero login routes) · ⑤ `registerScans` takes only an attachment id and reads path/mime off
    the caller's own row · ⑥ `stampAndUpsertAreaMap` requires a caller-owned/unattached attachment
    and refuses trashed listings · ⑦ geo deletes clear their FK-less `AreaMap`/masterplan/update
    assets via `geoCleanupOps()` · ⑧ brokerage upload cleans up after a failed row write ·
    ⑨ brokerage `partner/listings/new` has the 🔒 no-grant card · ⑩ lean-form Cancel has a
    dirty-check confirm · ⑪ «إخفاء» confirms before pulling a listing off both sites · ⑫ `/sell`
    localizes headings + geo names · ⑬ lean CREATE is idempotent (identical trio+title from the same
    owner within 60s updates instead of twinning) · ⑭ branded MAP renditions are reclaimed at all
    three re-stamp sites via `unlinkSupersededStamp()` (clean map is the guard) · ⑯ purge cron pages
    in 200-row batches · ⑰ `SearchLog(site, surface, createdAt)` added (migration
    `20260722120000_searchlog_surface_index`) · ⑱ backup Test-connection now probes EVERY enabled
    tier's own folder · ⑳ city-mandatory backfill pages 500 at a time over `values: { none }`.
  - **Verified already-done — re-check before ever re-reporting:** the plots-tab quota gate (wave 6:
    `consumeRationingQuota` runs BEFORE `plotGroups`) · the analytics-rollup backfill cap
    (`MAX_BACKFILL_DAYS = 120`) · **`LandFollow.districtId`/`blockId` indexes** — they already exist
    as `LandFollow_blockId_fkey`/`_districtId_fkey`, because **MySQL auto-creates an index for every
    FK constraint**; adding `@@index` would be a pure duplicate. (Same class of false positive as the
    `dedupeKey` one — check the live schema, not just `schema.prisma`.)
  - **Deliberately deferred (documented, not forgotten):** converting the analytics rollup /
    price-index / `plotsSummary` Node materialization to SQL aggregation. Each is a sizeable rewrite
    of a working, verified feature with no measurable impact at current volume (~1200 distinct plots;
    the rollup's backfill is already capped). Revisit if traffic or inventory grows an order of
    magnitude.
  - **⚠️ Plus: nothing in this whole audit is click-tested** — all of it is reasoned, typechecked,
    built, deployed and HTTP-probed, but no admin/partner session was ever exercised (no login
    available to the agent, and entering passwords is off-limits). **The new partner account page
    (verify-before-commit for email/phone) is the highest-value thing to click-test first.**

**2026-07-15→17: gallery/perf/admin-UX batch (commits `eaf3708`→`df78560`, all deployed+verified).**
- **Hero gallery + lightbox** on both sites' listing pages (see Feature map) + **first-party photo
  analytics** with admin toggle. The WhatsApp "ask about this photo" button was built, then toggled
  off, then **fully deleted 2026-07-17** at the owner's request (code + setting + prod row).
- **Thumbnail pipeline** for card covers (mirrored `/thumb` routes; a 2.0MB cover → 33KB WebP);
  covers everywhere resolve location-map → first photo → **neighborhood masterplan fallback**
  (`coversForListings`/`coversFor`, both mirrors — so a new listing with no drawn map/photos still
  shows its area map, never a blank card). **0/blank price** anywhere public renders «السعر عند
  الطلب / تواصل لمعرفة السعر» (normalized 0⇒null in the brokerage card+detail builders, guarded on
  the portal market card/detail/compare/similar + the structured-data Offer) — added 2026-07-18.
- **Soft delete** (migration `20260716140000_listing_soft_delete`): delete buttons in admin lists
  → trash with restore/purge at `/admin/marketplace/listings/deleted` (admins only), purge cron
  daily 03:40, ~15 query sites gained the `deletedAt: null` filter (see Architecture rules).
- **Auto-save-as-draft** on the listing form (all portal entry points): create-once-update-after
  via draftIdRef, 15s snapshot diff, only when new or still DRAFT — never demotes PENDING/PUBLISHED.
- **Admin QoL:** global «+ إضافة عرض» quick-add button in the admin topbar; per-user
  «استخدمتها مؤخراً» recently-used-features grid on the dashboard (localStorage, up to 8, filtered
  by the user's RBAC nav); city detail/edit split under `/admin/lands/cities/[id]` (read-only
  detail like districts; editor at `/edit`); watermark settings page now uses **brand tabs**
  (state stays mounted — unsaved edits survive switching).
- **Al Sawarey site review round:** EN-version language fixes, favicon.ico route (relative-Location
  308 — the reverse-proxy redirect landmine applies), homepage OG, footer «روابط مفيدة» (5 external
  links incl. newobour.city), richer services cards on the portal home, ≥40px tap targets,
  listings counter hidden below 5.
- **SEO:** meta descriptions rewritten to ~155-char human text on key pages of both sites (Google
  was scraping card fragments because the old ones were too short) + **GSC connected** (item 8).
- **Search Intelligence review (2026-07-17):** only 12 searches logged so far; the single real
  zero-result term («الحي العاشر», logged pre-fix on 07-12) now returns its listing (live-verified
  incl. the «الحى» variant); the rest were test probes. SearchSynonym + SearchLead still empty —
  synonym curation waits for real traffic.
- Also 07-15: admin-only «أقل سعر» (walk-away price) field beside the price note; neighborhood
  «available areas» now auto-merge the standard sizes of PUBLISHED+SOLD plots placed there
  (`apps/portal/lib/neighborhoodAreas.ts`, both explore pages); geo-summary word-duplication fix
  («حي الحي الأول»); staff ✎-edit button on Al Sawarey listing pages (needs the sw_admin token);
  admin-editable congratulations-SMS text.
- **07-17 (later, commits `730fcb4`+`e6794c1`): rationing scan-reconciliation suite.** The scans
  page (`/admin/rationing/scans`) stats are now clickable drill-downs: «صور بلا صفوف» (orphan
  photos: preview/delete + near-match suggestion with one-click **«اعتماد هذا الاسم»** rename —
  normalization ignores extension/separators/leading zeros, edit distance ≤2; `renameScan` action
  only changes the DB match key, image untouched) · «صفوف بلا صورة» (per-file rows count,
  show-rows modal, copy-name, reverse «ربط هذه الصورة» suggestion, **per-import coverage chips**
  grouped by SheetImportBatch) · new 5th stat **«فجوات ترقيم محتملة»** (`findSerialGaps`: serials
  skipped mid-sequence in the `DD MM YYYY NN` filename pattern with neither photo nor rows =
  pages probably never scanned nor typed; copy-chips give ready file names). Duplicates page
  got a real photo-thumbnail column (click→Lightbox, ESC/✕/backdrop closes; «لا توجد صورة» badge).
  **Prod diagnosis recorded:** the review queue's 181 photo-less records = ~166 rows from
  8 unscanned April pages (23/26/29-04, mostly in `Digitized.csv_2026_04`) + 3 rows whose Excel
  wrote `12_07_2026_0X.jpg` (underscores) vs the uploaded `12 07 2026 0X.jpg` (spaces) — the
  latter are one-click fixable in the new panel; the April pages need scanning (owner).

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

- `HANDOFF.md` — cross-account/session continuation: current status + how to pick up
- `README.md` — quickstart + stack
- `DEPLOY.md` — original server setup narrative (this file supersedes it where they differ)
- `ROADMAP.md` — feature scoping + status log
- `security.md` — security posture + hardening decisions
- `ops/README.md` — every server script + cron, indexed
- `ops/CLOUDFLARE.md` · `ops/RESTORE.md` · `ops/MAIL-DELIVERABILITY.md` ·
  `ops/HARDENING.md` — task runbooks (the retired `ops/OFFSITE.md` off-site-rsync runbook was
  deleted 2026-07-21; off-site backup is now the tiered module — see `C:\Claude\YeldnIN\BACKUP.md`)
