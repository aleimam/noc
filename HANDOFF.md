# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-22 (end of day) · Written so a new Claude session (on any account, same device) can continue this project._

> **Read `CLAUDE.md` first — it is the master onboarding doc** (architecture, the production
> deploy runbook with every gotcha, the server map, feature map, architecture rules, and the
> owner-blocked list; last full update 2026-07-22 — same day as this file). This HANDOFF only
> covers **session-transition facts**: what state you're inheriting and what lives on this
> device but outside the repo.

## What this project is

One Turborepo monorepo powering **two live production websites** that share one MariaDB backend:
**newobour.com** (`apps/portal`) is a free Arabic community portal for New Obour City (land
explorer, rationing lists, marketplace, calculator) and **alsawarey.com** (`apps/brokerage`) is a
commercial land-brokerage storefront. Both are managed from a single admin inside the portal.
Users are low-literacy/low-tech on phones — the design rule is *biggest, simplest, most explicit*.

## Current status — NOTHING is mid-flight

**Live, healthy, fully deployed, clean tree.** Local `main` and production are in sync — last
CODE commit **`e346bfb`** at handoff, with docs-only commits on top (verified 2026-07-22 on both
local and `ssh noc` — this hash is a landmark, not a guarantee; always re-verify with
`git log --oneline -1` on the server). Both pm2 apps online. Every feature requested to date is
shipped, deployed, and live-verified — there is **no half-finished work** (build passes 3/3;
`git status` is clean; `npx vitest run` = 35/35).

**Six things changed the shape of the system on 2026-07-22 — read `CLAUDE.md` → "Current state
& pending" for the detail, but do not miss these:**
1. **Cloudflare is LIVE in front of both domains** (proxied, Full-strict, WAF + Bot Fight Mode +
   rate limiting + hotlink protection). **Never enable Rocket Loader** (breaks Next hydration) or
   **"Cache Everything"** (would cache admin/logged-in HTML). Rollback = grey-cloud, one click.
2. **The Brevo SMTP key was rotated** to login `b19e6d001@smtp-brevo.com`. ⚠️ That account has an
   **Authorised-IPs allowlist** containing `77.42.66.76`. **If the server IP ever changes, ALL
   outbound mail (OTP, backup alerts) dies with `525 5.7.1 Unauthorized IP address`** until the
   new IP is added in Brevo. Rotate only via `ops/mail-relay-brevo.sh rotate` — it authenticates
   BEFORE writing.
3. **The Codex audit is CLOSED** — all 20 remaining findings worked. Two FALSE POSITIVES are
   recorded in `CODEX_AUDIT_FINDINGS.md`; do not re-act on them (`RationingSheet.dedupeKey`
   UNIQUE index, and `LandFollow` indexes that already exist as FK indexes).
4. **Partner portal was click-tested by the owner and fixed** — including a real cross-partner
   leak in «الصواري». Its switch convention is a settled owner decision: *green + right = live
   and sellable*.

5. **⚠️ B3 (lock the origin to Cloudflare) is OFF — it was tried and rolled back.**
   `ops/cloudflare-lockdown.sh` is correct and ready, but enabling it 2h after the flip broke
   alsawarey.com for the owner: their browser still had the pre-flip A record cached and hit the
   origin directly, getting a hard nginx 403. **Do not enable until ~24–48h past the DNS TTL**,
   and confirm from a NORMAL browser (never `curl --resolve`, which hides this entirely). Two
   reusable traps are in the script header: nginx `allow`/`deny` sees `$remote_addr` AFTER
   `real_ip` rewrites it, and Cloudflare blocks this box's own IP so server-side "does it work
   through Cloudflare?" checks are guaranteed false negatives. B3 also makes rollback two steps:
   `lockdown off` FIRST, then grey-cloud.
6. **Dark mode is GONE from both public sites** (owner decision — accidental-tap footgun for
   low-literacy visitors). Nothing can add the `dark` class; `ThemeScript` clears it and expires
   the old cookie. **The 123 `dark:` classes across 36 files are dormant ON PURPOSE** — don't
   "tidy" them away; leaving them keeps the decision reversible in one commit.

**The Brevo rotation is fully CLOSED (2026-07-22).** The old key belonged to login `b17e37001`,
whose organisation the owner deleted — that revokes its credentials. The live account's SMTP key
list was checked directly and holds no stale NOC key: the only row named NOC ends `…2GmpgV`,
which was matched against the server BEFORE touching anything (deleting it would have killed OTP
and backup mail instantly). Not independently provable — Brevo answers an identical `535` for an
unknown login and a wrong key, and the old key's last copy was shredded with the backups.

⚠️ **When auditing SMTP keys in that Brevo account, note it also holds keys for OTHER projects**
(veeey.net, EVnet, WC, egyptvitamins.net). Always match a key's last 6 characters against what is
live for that project before deleting a row.

**✅ CLICK-TESTED: the owner exercised BOTH the partner and admin portals on 2026-07-22 and reported
no defects — closing the standing "never click-tested" caveat on the whole audit. (Their earlier
partner pass that day DID find two real defects, so a clean pass is signal, not silence.)

⚠️ Three things a normal click-through CANNOT reach, so treat them as unproven unless someone
deliberately forced the condition: the listing-form auto-save FAILURE panel (needs the save to
actually fail), the partner account page's OTP-verified email/phone change, and sold → hide → show
restoring SOLD (covered by 10 vitest cases, never in a UI).

## Done LAST (2026-07-20, final block): Codex audit pass 1 — 7 defects + 7 extras, all fixed

Commits `06e58e5` → `baf90b1`, all deployed + live-verified. Codex ran **pass 1 of 16** from
`CODEX_AUDIT_BRIEF.md` (listings + EAV) into **`CODEX_AUDIT_FINDINGS.md`**, which now carries a
**resolution table at the top — read it before running another pass so nothing is re-reported.**
Everything was re-verified against the code and against production data before being changed; two
findings were only provable by looking at live data. Full narrative in `CLAUDE.md`. If you pick up
here, the three things most worth knowing:

1. **The `listItem ?? option` rule applies to FILTERS and hard-coded facets, not just reads.**
   `/market`'s SELECT filters were matching only the legacy `optionId` while production has **0**
   legacy rows — every facet silently returned an empty list. Check this on ANY new query touching
   a SELECT value.
2. **Two new shared gates must be used by any new listing write path:**
   `@noc/partner-portal/required` (required details — call it on every transition to
   PENDING/PUBLISHED) and `@noc/partner-portal/values` (`normalizeListingValues` +
   `validateClassifierTrio`). Values must be normalized BEFORE the required check, or a value in
   the wrong column can satisfy a requirement.
3. **Money has ONE rule now** — `parsePriceInput()`/`isStoredPrice()` in `@noc/config`. 0/blank ⇒
   «السعر عند الطلب», negative/non-finite ⇒ error. Don't reintroduce a bare `price != null` check;
   that is exactly what put «0 ج.م» on the public home page and in the Google/WhatsApp description.

~~**Not click-tested**~~ **SUPERSEDED — the owner click-tested the partner AND admin portals on
2026-07-22 with no defects reported** (see "Current status" above). The archive toggle and the
Approve-disabled-when-incomplete state are covered by that pass; only the auto-save FAILURE panel
still needs a deliberately induced failure to prove.

## Done earlier the same day (2026-07-19 → 20)

All deployed + live-verified (commits `2356b26` → `e395a3d`). Full detail in `CLAUDE.md` →
*Current state & pending*; the headlines:

1. **⭐ Admin-configurable REQUIRED listing details** — the session's big feature. New
   `Attribute.required` column (migration `20260719120000_attribute_required`, default false so
   nothing changed retroactively; `city` backfilled to preserve old behaviour). Admin sets it per
   attribute (★ checkbox) or per section (bulk buttons) at `/admin/marketplace/attributes`; both
   listing forms show ★ + «(مطلوب)» and block publishing with a red highlight + scroll-to-first.
   **Enforcement lives at FOUR sites that must stay in step** — see the new Architecture rule in
   CLAUDE.md. **PHOTOS/DOCUMENTS can never be required** (attachment-backed; would soft-lock
   publishing) and a boolean `false` counts as answered.
2. **Owner's live required settings (7):** المساحة · المدينة · 5 of the 6 مستحقات جهاز المدينة —
   the generic «القسط السنوي» was deliberately made optional. أصل المساحة + all مميزات الموقع are
   optional. Set directly in prod DB at the owner's request; existing listings unaffected.
3. **Global RTL placeholders** — one CSS rule per app makes every Arabic placeholder render RTL,
   including inside deliberately `dir="ltr"` fields. Future inputs need no per-field fix.
4. **`PasswordInput` (@noc/ui) is now the house standard for every password box** — 👁/🙈 toggle,
   applied to all seven fields across both sites. Use it for any new password field.
5. **Partner portal**: «🛒 عرض في السوق» button per published listing (hidden where the storefront
   would 404); nav tabs unified to **إعلاناتي** on both apps (brokerage had stale labels).
6. **Polish+harden pass** (self-review + independent review agent, 6 verified fixes) followed by a
   **production sweep** (logs, crons, backups, 18-URL crawl, consoles) — one real defect found and
   fixed: `favicon.ico` routes now `force-dynamic`, killing a recurring `LRUCache` log error on
   both sites. No 5xx, backups current, analytics rollup fresh.
7. **`AGENTS.md` added** at the repo root so non-Claude agents (Codex) onboard from CLAUDE.md.
8. **⭐ TIERED OFF-SITE BACKUP MODULE — built, deployed, and LIVE** (the biggest item of the day;
   migration `20260720120000_backup_module`). Implements the portable spec at
   `C:\Claude\YeldnIN\BACKUP.md` **alongside** the existing local nightly backup — that one is
   untouched and still runs. Four levels push to a Hetzner Storage Box over SFTP:
   hourly DB-only (keep 24) · daily + weekly full (7/8) · MANUAL button-only (10), each in its
   OWN remote folder. **Verified end to end 2026-07-20**, not merely assumed:
   - a **cron-fired SCHEDULED run succeeded** (08:00:02 → `noc-backup-db-20260720-080002.tar.gz`)
     in the standalone tsx worker — the `server-only` trap that broke veeey's scheduled path does
     NOT apply here (see the comment at the top of `packages/backup/src/service.ts`);
   - a **full restore drill passed**: 667 MB archive downloaded byte-exact, manifest matched,
     restored into a SCRATCH database (never live) → 82 tables, and all 12 business tables
     row-identical to production (RationingSheet 4862). Scratch DB dropped afterwards.
   - **Still unproven:** a retention prune has never deleted a real remote file (needs more than
     `keepLast` archives to accumulate — first chance ~24h after 2026-07-20 08:00).

## In progress / not finished

**Nothing is mid-flight.** Two threads are intentionally parked, both owner-side, neither blocking:

- **Listing #2607501 has no drawn location map.** Its card thumbnail is now covered by the
  masterplan fallback, but the *big annotated* location map on its poster/detail only appears once a
  staff member draws the plot in the admin (Edit → ✎ «إنشاء خريطة الموقع من مخطط الأصل» → mark plot →
  Save → regenerate). Only the owner knows where the plot sits, so this is theirs to do. (Verified
  the annotator works and shows مجاورة 6's own correct masterplan.)
- **Optional `ops/find-orphan-maps.ts`** sweeper (report + `--delete` for area-maps whose
  neighborhood/district was deleted) was *offered but not built* — there are currently zero orphans,
  so it's pure convenience. Build it only if the owner asks.

## Next steps — ALL owner-action, nothing is dev-blocked

Full detail in `CLAUDE.md` → owner-blocked list. Short version, roughly by effort:

1. **Partner portal click-test** (5 min) — the old `testpartner` was **deleted from prod
   2026-07-20** (orphan login: `User.ownerId` NULL → no owner/grants → couldn't post, so the test
   was never actually done through it). Create a FRESH partner properly first (admin → Owners → add
   owner → its partner card: login + both sites + category grants), log in on each `/partner` site,
   submit the lean form, confirm PENDING in moderation, **then delete that owner+user.**
2. ~~Off-site backups~~ **✅ DONE + fully proven 2026-07-21** — tiered SFTP module live; scheduled
   runs firing, restore drill passed, and the **first retention prune ran + was verified** (07:00 UTC:
   deleted exactly the oldest hourly, `/home/hourly` now holds exactly 24, all `noc-backup-`, no
   other app's files touched). SFTP host key now pinned + verified too. **✅ OLD off-site rsync
   RETIRED 2026-07-21** (owner chose "off-site rsync only"): deleted `offsite-backup.sh`,
   `offsite.env.example`, `OFFSITE.md`, the `noc-offsite` cron, and the off-site config/test panel +
   server actions from the Backups admin. The LOCAL nightly `ops/backup.sh` (+ its cron, alerts,
   download/restore) is deliberately KEPT as the on-box safety layer.
3. **Rotate the Brevo SMTP key**, then re-apply via `ops/mail-relay-brevo.sh`.
4. **Price Index toggle** — Settings → Modules → مؤشر الأسعار, whenever wanted.
5. **Cloudflare proxy flip (Part C)** — biggest remaining security win; ordered checklist in
   `ops/CLOUDFLARE.md`; grey-cloud is the instant rollback.
6. **English content entry** (owner paused "later") — `/sell` page + storefront hero title/subtitle
   + hero image, in the admin Storefront editor.
7. **GSC check-up ~2026-07-23** — coverage on both domains + that the alsawarey sitemap moved to
   Success.
8. **Partner portal click-test** — the old `testpartner` was **deleted from prod 2026-07-20**
   (orphan login: `User.ownerId` NULL → no owner/grants → couldn't post, so the test was never
   actually done through it). Create a FRESH partner properly first (admin → Owners → add owner →
   its partner card: login + both sites + category grants), submit the lean form on each `/partner`
   site, confirm PENDING in moderation, **then delete that owner+user.**
9. **Click-test the admin/listing UI changes** (same admin login as #8) — all reasoned +
   typechecked + deployed, none clicked: (a) archive toggle only on PUBLISHED/ARCHIVED rows;
   (b) Approve disabled + missing-details named on incomplete pending rows; (c) listing form's red
   auto-save-failed panel + Retry; (d) per-row 🖼️ poster / 🗺️ map quick-links in both listing lists;
   (e) missing-required-field red highlight + «هذا الحقل مطلوب» note on both listing forms (hit
   Publish with fields blank); (f) one-click ✓ approve on قيد-المراجعة rows at `/admin/newobour/market`.
   Full list in `CLAUDE.md` → "Verification pending".
10. **Codex audit** — pass 1 fixed+verified; passes 2–11 run (findings in `CODEX_AUDIT_FINDINGS.md`,
   UNVERIFIED); one pass-9 item (SFTP host-key pin) already fixed+verified. Run passes 12–16, then
   one verify-then-fix triage of the whole set.
10. **Continue the Codex deep audit** — pass 1 of 16 done (14 fixes live; resolution table in
   `CODEX_AUDIT_FINDINGS.md`). Run passes 2–16 a pass at a time from `CODEX_AUDIT_BRIEF.md`
   (read-only, chatgpt.com/codex), bring each back for verify-then-fix. `/code-review ultra`
   (billed, owner-triggered) is the separate heavyweight option; fold either's findings into
   `security.md` §7.
11. **Rationing photo backlog** — 8 unscanned April pages need photographing; one-click filename-typo
   fixes wait in `/admin/rationing/scans`.

## What lives on this device but NOT in the repo

Carries over automatically under the **same Windows user**; recreate if a different Windows profile:

| Thing | Where | Notes |
|---|---|---|
| Local env | `C:\Claude\NOC\.env` | gitignored. Prod secrets live only in `/root/noc/.env` on the server (600). |
| Dev database | `C:\Claude\NOC\.devdb\` | portable MariaDB via `npm run db:start`; gitignored but on disk. |
| SSH access | `~/.ssh/config` alias **`noc`** → `root@77.42.66.76` (key-only) | Deploys depend on `ssh noc`. |
| Claude auto-memory | `C:\Users\aleim\.claude\projects\C--Claude-NOC\memory\` | Convenience only — everything essential is in `CLAUDE.md`. |
| Chat history | previous account's sessions | Does NOT carry — that's why these docs exist. |

Reference material **moved OUT of the repo on 2026-07-20** to keep the working tree clean. It now
lives in **`C:\Claude\NOC-reference\`**: `NOC00-02.docx` + `SMS-Partners.docx` (the original
requirements), `NewObour Design System/` and its 42MB zip — **still the source of
`newobour-advanced-features.md`, which ROADMAP.md cites for the unbuilt Phase 2/3 features** — and
`input data/2026-06 Rationing - corrected.xlsx` (the source Excel behind the imported rationing
records). All of it was gitignored, so **this PC is the only copy: it is NOT in git, NOT on the
server, and NOT covered by the backup crons. Do not delete it.** A copy was pushed to
**Google Drive (`G:My DriveNOC-reference`) on 2026-07-20**, so it now survives a disk loss —
re-sync that copy if the local folder ever changes.

Still inside the repo: `Identity/` (tracked brand assets — real logos: ALSWARY =
`Identity/1000X1000.png`, New Obour = `Identity/New Obour.png`) and `uploads/` (local dev only).

## Important context, decisions & gotchas (don't relitigate / don't break)

1. **Deploy runbook gotchas** (CLAUDE.md §deploy — memorise): `git checkout -- package-lock.json`
   BEFORE pulling, and **always verify `git log --oneline -1` on the server** afterwards — a dirty
   tree makes the pull abort while the chained build "succeeds" on stale code. `db:release` NEVER
   seeds. Env changes need `pm2 restart ecosystem.config.js --update-env`.
2. **Partner visibility is now DECOUPLED from site-access** (this session): site-access = login
   only; partner listings show on both sites. `newObourVisibility()`/`alsawareyVisibility()`/
   `listingVisibleOnNewObour()` were changed accordingly. Don't reinstate the old per-site gating.
3. **Poster card order is FINAL** (map · مميزات · مستحقات · الموقع, by section key) — the owner
   iterated on this repeatedly; leave it.
4. **Required listing details have FOUR enforcement sites** — the two client forms
   (`ListingForm.tsx`, `LeanListingForm.tsx`) and the two server saves (`account/listings/actions.ts`,
   `partner-portal/listingSave.ts`), plus the admin guards in `upsertAttribute`/`setSectionRequired`.
   Change one → change all. PHOTOS/DOCUMENTS must stay exempt (attachment-backed: requiring one
   soft-locks publishing) and boolean `false` counts as answered. Full rule in CLAUDE.md.
5. **Mirrors kept identical by discipline only:** `apps/{portal,brokerage}/lib/search.ts`,
   `apps/{portal,brokerage}/app/thumb/[...path]/route.ts`, and now
   `apps/{portal,brokerage}/app/api/listings/alive/route.ts`. Change one → change both.
6. **Soft delete:** any new public listing read must respect `deletedAt: null` (use the central
   visibility helpers in `@noc/partner-portal`); the purge cleanup transaction is mirrored in the
   admin action + `ops/purge-deleted-listings.ts`.
7. **Backup module gotchas** (each cost real debugging on one of the three apps): Hetzner SFTP is
   **port 23**, not 22 (22 answers but is chrooted and silently writes `/home/home/…`); a
   sub-account sees its base dir as **`/home`**, not `/noc`; every level needs its OWN remote
   folder or their retentions prune each other; the `noc-backup-` prefix is the ONLY thing stopping
   NOC deleting YeldnIN's or veeey's archives on the shared box; `packages/backup/src/service.ts`
   must never `import 'server-only'` (it runs in the standalone cron — that exact import broke every
   SCHEDULED run on veeey while manual ones passed); `ssh2` must stay in `serverExternalPackages` in
   BOTH apps (its native addon breaks the webpack build, and it does NOT reproduce locally when npm
   blocked the install script — a green local build proves nothing there); CSF `TCP_OUT`/`TCP6_OUT`
   must keep port **23** (`csf.conf` backup at `/root/csf.conf.bak-*`).
8. **Owner decisions — don't re-litigate:** Card Title retired; both areas required for the reconcile
   auto-fill; transfer fee 180/م²; restore stays CLI-only; neighborhood map inheritance is
   explore-only; the gallery WhatsApp button is deliberately deleted; Outlook→spam is shared-IP
   reputation, not DNS.
9. **Never delete Settings `gsc_newobour`/`gsc_alsawarey`** — Google Search Console verification
   renders from them.
10. **elbarbary / «عقيد إسلام البربري»** is a real partner set to Al-Sawarey-login-only; his listings
   now show on both sites (via the decoupling), which is intended — the owner explicitly asked for it.

## Key files — where the latest-session work lives

**Required listing details (2026-07-19→20):**
- `packages/db/prisma/migrations/20260719120000_attribute_required/` — the additive migration.
- `apps/portal/app/account/listings/{ListingForm.tsx,actions.ts,catalog.ts}` — full form + server save.
- `packages/partner-portal/src/{LeanListingForm.tsx,listingSave.ts,catalog.ts}` — partner side.
- `apps/portal/app/admin/(protected)/marketplace/{actions.ts,attributes/}` — ★ toggle, bulk
  `setSectionRequired`, `SectionRequiredControls.tsx`, and the file-type guards.

**Tiered off-site backup (2026-07-20):**
- `packages/backup/src/logic.ts` + `logic.test.ts` — PURE scheduling/naming/retention, **24 vitest
  tests** incl. the two retention safety invariants. Changing retention? Run `npm test` first.
- `packages/backup/src/{service,transport,secret-box}.ts` — archive build (mysqldump
  `--single-transaction`, uploads, `.env`, manifest), SFTP, AES-256-GCM password at rest.
- `ops/backup-tick.{ts,sh}` — the every-10-min cron entry (`--install-cron`).
- `apps/portal/app/admin/(protected)/settings/backups/{OffsiteTiers.tsx,offsite-actions.ts}` — the
  admin panel, added BELOW the existing local-backup sections.
- `packages/db/prisma/migrations/20260720120000_backup_module/` — tables + seeded levels.

**Global UX (2026-07-20):**
- `packages/ui/src/components/PasswordInput.tsx` — the eye-toggle password box (use it everywhere).
- `apps/{portal,brokerage}/app/globals.css` — the RTL-placeholder rule (mirrored; url inputs excluded).
- `packages/partner-portal/src/{PartnerListings.tsx,Dashboard.tsx}` — «عرض في السوق» + eligibility.
- `apps/{portal,brokerage}/app/favicon.ico/route.ts` — force-dynamic 308 (LRUCache fix).

**Earlier batch (2026-07-18→19), still current:**
- `apps/portal/lib/poster/generate.ts` — `POSTER_CARD_ORDER` (poster card order by section key).
- `apps/portal/lib/poster/render.ts` — poster SVG layout (row-major grid, map slot 1).
- `packages/partner-portal/src/visibility.ts` — the decoupled visibility helpers.
- `apps/{portal,brokerage}/app/partner/(protected)/layout.tsx` — partner nav (إعلاناتي / عروض الصواري).
- `packages/ui/src/components/RecentlyViewed.tsx` + `apps/{portal,brokerage}/app/api/listings/alive/route.ts` — auto-prune dead cards.
- `apps/brokerage/lib/listings.ts` + `apps/portal/lib/listingCovers.ts` — 0-price + masterplan cover fallback.

## How to continue

Open a session in this folder (`C:\Claude\NOC`) — `CLAUDE.md` auto-loads. Say:

**"Read HANDOFF.md and continue this project."**

Expected workflow for every task (the owner expects the full cycle): build → typecheck/build →
commit (Arabic-safe heredoc message) → push → deploy via the runbook → **verify live**.
