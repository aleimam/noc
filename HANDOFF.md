# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-22 (after the admin-English sweep) · Written so a new Claude session (on any account, same device) can continue this project._

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

**Live, healthy, fully deployed, clean tree.** Local `main` and production are in sync at
**`e6184ed`** — verified on both sides at handoff time, not assumed (last CODE commit is
`8bbc722`; `e6184ed` is docs-only on top). **This hash is a landmark, not a guarantee — always
re-verify with `git log --oneline -1` locally AND on `ssh noc`.** Every feature requested to date
is shipped, deployed and live-verified; there is **no half-finished work**.

Verified at handoff (2026-07-22, after the admin-English sweep):
- both pm2 apps `online`; `git status` clean locally; build 3/3; `npx vitest run` 35/35
- five live URLs 200 (both homepages, `/admin/login`, `/market`, `/listings`)
- no new errors in `noc-portal-error.log` since the deploy (the three older entries are from
  07-20 and 07-22 02:27 and predate it)
- disk 31% · all 7 `noc-*` crons present · local nightly backup current (07-22 03:30, 677 MB)
- tiered off-site backup healthy — hourly runs `SUCCESS` every hour through 07-22 10:00

⚠️ The server working tree carries a modified `package-lock.json` again (npm install dirties it)
plus three untracked `*-backup-*.json` files left in `/root/noc` from 2026-07-05. Untracked files
are harmless, but **the lock file will abort the next `git pull --ff-only`** — the runbook's
`git checkout -- package-lock.json` first step is not optional.

**Seven things changed the shape of the system on 2026-07-22 — read `CLAUDE.md` → "Current state
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
7. **Admin English coverage is DONE — all 93 files.** The owner reversed the morning's "deferred"
   decision. Binding constraint, already applied: **UI chrome only — admin-EDITABLE content stays
   Arabic in both languages** (storefront/sell defaults in `packages/config`, option lists, geo
   names). If you add an admin screen, translate its labels with the inline `L('ar','en')` helper
   and get the locale from `useLocale()` (client) or `await getLocale()` (server) — the provider is
   already at the root layout, so nothing needs threading. **Don't add an i18n lint rule without
   asking**; that was part of the rejected estimate, not of what was approved.

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

## Done LAST (2026-07-22, final block): admin English coverage — all 93 files

Commits `f0f92aa` → `8bbc722` (+ docs `e6184ed`), deployed and live-verified. The owner reversed
that morning's "deferred" decision and asked for the whole sweep, with one binding constraint:
**translate UI chrome only; admin-EDITABLE content stays Arabic in both languages.**

What a next session needs to know:

1. **The pattern, if you add an admin screen.** `NextIntlClientProvider` is mounted at the root
   layout, so nothing needs prop-threading: client components do `const locale = useLocale() as
   'ar' | 'en'`, server components `const locale = (await getLocale()) as 'ar' | 'en'`, then the
   inline `const L = (ar, en) => (locale === 'ar' ? ar : en)` that 47 admin files already used.
   Module-scope constant maps can't see the locale, so their labels are `[ar, en]` tuples spread
   as `L(...MAP[key])`.
2. **The estimate that was wrong.** This was previously scoped at "~200 files plus a lint rule" and
   deferred on that basis. It was **93 files / 596 lines / 326 distinct strings**, because the
   expensive part (locale threading) did not exist. Worth re-measuring before deferring similar work.
3. **Two traps that will recur in any translation sweep.**
   - *Logic that keys off display text breaks silently.* `offers/[id]/page.tsx` chose text direction
     by regex-matching the Arabic label (`dir={/هاتف|السعر|المساحة/.test(k) ...}`). Translating the
     labels would have flipped RTL/LTR on every phone, price and area value — no type error, nothing
     visible in a build. Grep for that shape BEFORE translating.
   - *A line-by-line "is this translated?" check cannot see a multi-line `L(` call.* It reports the
     Arabic argument as untranslated; I "fixed" ~10 of those into 3-argument calls before tsc caught
     it. All reverted.
4. **Deliberately still Arabic — do not "finish" these.** The Excel export routes (their
   `Arabic / English` headers belong together in one cell, since the file is shared outside the
   admin), the import template's Arabic sample rows, and the SMS bodies sent to citizens.
5. **What is NOT proven.** Only `/admin/login` was ever seen rendered (locale switching confirmed
   live: `NEXT_LOCALE=en` → "Sign in / Email / Password"). The other 92 files are typechecked,
   built, deployed and HTTP-probed but never clicked — no admin login is available here. A static
   check did confirm all **1074** ar/en pairs are ordered Arabic-first (a swapped pair would compile
   cleanly and render wrong in both languages).

## Done earlier (2026-07-20): Codex audit pass 1 — 7 defects + 7 extras, all fixed

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

## Next steps — nothing is dev-blocked

Everything below waits on the owner or on the clock. Ordered by what unblocks soonest.

1. **⏳ Cloudflare B3 — the only timed item.** `ops/cloudflare-lockdown.sh on` restricts the origin
   to Cloudflare's ranges. It is **OFF**; it was enabled on 2026-07-22 and rolled back because the
   owner's browser still had the pre-flip A record cached and hit the origin directly (hard nginx
   403 on alsawarey). **Wait ~24–48h past the DNS TTL from the 07-22 flip**, then — before enabling
   — confirm in a NORMAL browser that both names resolve to Cloudflare. **Never validate with
   `curl --resolve`**: it forces traffic through Cloudflare and hides exactly this failure. After
   enabling, rollback becomes two ordered steps: `lockdown off` FIRST, then grey-cloud.
2. **⏳ GSC page-indexing coverage** — both properties still said "Processing data" on 07-22
   (they are only ~6 days old). Re-check in a few days. Sitemaps are already `Success` on both.
3. **Click-test the admin in English** (owner, ~10 min) — the 2026-07-22 sweep translated all 93
   admin files, but **only `/admin/login` was ever seen rendered**; the other 92 are typechecked,
   built, deployed and HTTP-probed, never clicked. A pass through the admin with the language set
   to English is the one gap no agent here can close (no admin login available). Look for awkward
   phrasing rather than breakage — argument order was verified statically across 1074 pairs.
4. **Three behaviours that a normal click-through cannot reach** — each needs a deliberately forced
   condition, so treat them as unproven:
   - the listing form's red «لم يتم الحفظ» auto-save panel + Retry (kill the network mid-edit);
   - the partner account page's OTP-verified email/phone change (`d3011de`) — needs a real code
     delivered to a NEW destination and entered. **Highest value of the three**, it is a P0
     identifier-change path;
   - sold → hide → show restoring «تم البيع» (`07cbe4c`) — proven by 10 vitest cases, never in a UI.
5. **Price Index module** — Settings → Modules → مؤشر الأسعار. Page + monthly snapshot cron are
   live but hidden behind the toggle. Owner's call on timing (deferred once already).
6. **English CONTENT entry** (owner paused 2026-07-16 — "later"). ⚠️ **Not the same thing as the
   admin-English sweep, which is done.** That was the admin's own UI chrome, in code. This is the
   owner typing English *content* into admin fields: the whole `/sell` page + the storefront hero
   title/subtitle, plus uploading a hero image (improves the homepage and the WhatsApp/OG share
   preview, which falls back to the logo today). All plumbing exists; pure data entry.
7. **`/code-review ultra`** — owner-triggered and billed; cannot be launched from here. Fold any
   findings into `security.md` §7.
8. **Rationing photo backlog** — ~8 unscanned April pages need photographing. Separately, a few
   filename-typo fixes are waiting as one-click actions in `/admin/rationing/scans`.
9. **Listing #2607501 still has no drawn location map.** The card thumbnail is covered by the
   masterplan fallback, but the big annotated map on its poster/detail appears only once someone
   draws the plot (admin → Edit → ✎ «إنشاء خريطة الموقع من مخطط الأصل» → mark plot → Save →
   regenerate). Only the owner knows where the plot sits.

**Explicitly NOT to do** (each was decided, not forgotten):
- Don't add a UNIQUE index on `RationingSheet.dedupeKey`, and don't add `@@index` for
  `LandFollow.districtId`/`blockId` — both are recorded false positives in
  `CODEX_AUDIT_FINDINGS.md`. Check the LIVE schema, not just `schema.prisma`.
- Don't strip the 123 dormant `dark:` classes across 36 files — they are left on purpose so the
  dark-mode removal stays reversible in one commit.
- Don't add an i18n lint rule to "stop the drift" without asking — that was part of an estimate the
  owner rejected, not of what was approved.
- Don't "finish" the Arabic left in the Excel export routes, the import template's sample rows, or
  the citizen SMS bodies — all three are deliberate.

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

**Admin English coverage (2026-07-22, the last block):**
- Spread across all 93 files under `apps/portal/app/admin/` — no new module, no message files.
  The convention is the inline `L('ar','en')` helper plus `useLocale()` / `await getLocale()`.
- `apps/portal/app/admin/(protected)/marketplace/offers/[id]/page.tsx` — the one structural change:
  table rows are now `[label, value, forceLtr]` because direction used to be inferred by
  regex-matching the Arabic label.
- `packages/config/src/index.ts` — `buildThemeCss` no longer emits a `.dark{...}` block (dead since
  dark mode was removed); `darkBg`/`darkFg` stay as legacy optional fields so stored theme JSON
  still parses.

**Partner portal switches + dark-mode removal (2026-07-22):**
- `packages/partner-portal/src/{PartnerNav.tsx,PartnerListings.tsx,availability.ts,Browse.tsx}` —
  shared nav with active-tab highlight, the two switches, the tested transition matrix, and the
  owner-type gate that fixed the cross-partner leak.
- `packages/partner-portal/src/availability.test.ts` — 10 vitest cases (35 in the suite overall).
- `packages/ui/src/components/ThemeScript.tsx` — repurposed to REMOVE the `dark` class and expire
  the old `NOC_THEME` cookie.

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
- `apps/{portal,brokerage}/app/partner/(protected)/layout.tsx` — partner shells. ⚠️ The nav itself
  moved to the shared `PartnerNav.tsx` on 07-22 and the second tab is now «الصواري» (renamed from
  «عروض الصواري»).
- `packages/ui/src/components/RecentlyViewed.tsx` + `apps/{portal,brokerage}/app/api/listings/alive/route.ts` — auto-prune dead cards.
- `apps/brokerage/lib/listings.ts` + `apps/portal/lib/listingCovers.ts` — 0-price + masterplan cover fallback.

## How to continue

Open a session in this folder (`C:\Claude\NOC`) — `CLAUDE.md` auto-loads. Say:

**"Read HANDOFF.md and continue this project."**

Expected workflow for every task (the owner expects the full cycle): build → typecheck/build →
commit (Arabic-safe heredoc message) → push → deploy via the runbook → **verify live**.
