# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-20 · Written so a new Claude session (on any account, same device) can continue this project._

> **Read `CLAUDE.md` first — it is the master onboarding doc** (architecture, the production
> deploy runbook with every gotcha, the server map, feature map, architecture rules, and the
> owner-blocked list; last full update 2026-07-20 — same day as this file). This HANDOFF only
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
commit **`e395a3d`** (verified 2026-07-20 on both local and `ssh noc`; always re-verify with
`git log --oneline -1` on the server). Both pm2 apps online. Every feature requested to date is
shipped, deployed, and live-verified — there is **no half-finished work** (build passes 3/3;
`git status` is clean).

## Done in the latest session (2026-07-19 → 20)

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

1. **Partner portal click-test** (5 min) — a dedicated `testpartner` exists (both sites, all
   categories). Log in on each `/partner` site, submit the lean form, confirm PENDING in moderation,
   **then delete the test owner+user.**
2. **Off-site backups** (10 min) — `/admin/settings/backups`: enter host/user/port/path, add the
   shown VPS pubkey to the remote's `authorized_keys`, click Test. Cron already installed.
3. **Rotate the Brevo SMTP key**, then re-apply via `ops/mail-relay-brevo.sh`.
4. **Price Index toggle** — Settings → Modules → مؤشر الأسعار, whenever wanted.
5. **Cloudflare proxy flip (Part C)** — biggest remaining security win; ordered checklist in
   `ops/CLOUDFLARE.md`; grey-cloud is the instant rollback.
6. **English content entry** (owner paused "later") — `/sell` page + storefront hero title/subtitle
   + hero image, in the admin Storefront editor.
7. **GSC check-up** — coverage on both domains + that the alsawarey sitemap moved to Success.
8. `/code-review ultra` whenever the owner wants it (billed); fold findings into `security.md` §7.
9. **Codex independent review** — `AGENTS.md` is in place so Codex onboards itself. Run it
   read-only from chatgpt.com/codex, then bring the findings back for triage (real vs. deliberate
   vs. false positive) and fold confirmed ones into `security.md` §7.
10. **Rationing photo backlog** — 8 unscanned April pages need photographing; one-click filename-typo
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
7. **Owner decisions — don't re-litigate:** Card Title retired; both areas required for the reconcile
   auto-fill; transfer fee 180/م²; restore stays CLI-only; neighborhood map inheritance is
   explore-only; the gallery WhatsApp button is deliberately deleted; Outlook→spam is shared-IP
   reputation, not DNS.
8. **Never delete Settings `gsc_newobour`/`gsc_alsawarey`** — Google Search Console verification
   renders from them.
9. **elbarbary / «عقيد إسلام البربري»** is a real partner set to Al-Sawarey-login-only; his listings
   now show on both sites (via the decoupling), which is intended — the owner explicitly asked for it.

## Key files — where the latest-session work lives

**Required listing details (2026-07-19→20):**
- `packages/db/prisma/migrations/20260719120000_attribute_required/` — the additive migration.
- `apps/portal/app/account/listings/{ListingForm.tsx,actions.ts,catalog.ts}` — full form + server save.
- `packages/partner-portal/src/{LeanListingForm.tsx,listingSave.ts,catalog.ts}` — partner side.
- `apps/portal/app/admin/(protected)/marketplace/{actions.ts,attributes/}` — ★ toggle, bulk
  `setSectionRequired`, `SectionRequiredControls.tsx`, and the file-type guards.

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
