# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-19 00:25 EDT · Written so a new Claude session (on any account, same device) can continue this project._

> **Read `CLAUDE.md` first — it is the master onboarding doc** (architecture, the production
> deploy runbook with every gotcha, the server map, feature map, architecture rules, and the
> owner-blocked list; last full update 2026-07-19 — same day as this file). This HANDOFF only
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
commit **`751c5cd`** (verified 2026-07-19 on both local and `ssh noc`; always re-verify with
`git log --oneline -1` on the server). Both pm2 apps online. Every feature requested to date is
shipped, deployed, and live-verified — there is **no half-finished work** (build passes 3/3;
`git status` is clean).

## Done in the latest session (2026-07-18 → 19)

All deployed + live-verified (commits `a207826` → `751c5cd`). Full detail is in `CLAUDE.md` →
*Current state & pending*; the headlines:

1. **Generated-poster big-card grid order finalised** to a FIXED order by STABLE section key
   (`POSTER_CARD_ORDER` in `apps/portal/lib/poster/generate.ts`): `location-pros → auth_pay →
   location`, placed row-major = **map · مميزات الموقع · مستحقات · الموقع** (cells 1 TL, 2 TR, 3 BL,
   4 BR). The owner iterated on this several times — **this is the final; do not reshuffle.**
2. **0/blank price ⇒ «السعر عند الطلب / تواصل لمعرفة السعر»** everywhere public (both sites).
3. **Card covers gained a neighborhood-masterplan fallback** — a new listing with no drawn location
   map and no photos now shows its area map instead of a blank placeholder card.
4. **⭐ Partner listing-visibility DECOUPLED from site-access (owner decision):** a partner's
   `siteNewObour`/`siteAlsawary` flags now gate **login only** — their listings show on **BOTH**
   public sites regardless. **This supersedes the earlier "partner listings only on enabled sites"
   rule — do not reinstate it.** (See `packages/partner-portal/src/visibility.ts`.)
5. **Partner portal tabs** renamed/split: **عروضي** (own listings, editable = dashboard) · **عروض
   الصواري** (view-only browse of all Al Sawarey offers). Account page got a reveal-password (👁)
   toggle on the new-password field.
6. **Admin label «البائع» → «أضيف بواسطة» / "Posted by"** (the account that posted the listing).
7. **«شوهدت مؤخرًا» auto-prunes deleted listings** via a new mirrored route `POST
   /api/listings/alive` (both apps) — fixes the blank "اختبار SEO" ghost cards the owner reported.
8. **Data cleanup:** removed one orphaned neighborhood-masterplan record (row + 3 image files);
   verified all 24 live neighborhood masterplans are otherwise distinct.

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
9. **Rationing photo backlog** — 8 unscanned April pages need photographing; one-click filename-typo
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

Root reference material (in the folder, not code): `NOC00-02.docx`, `SMS-Partners.docx`,
`NewObour Design System/`, `input data/`, `Identity/` (real logos: ALSWARY =
`Identity/1000X1000.png`, New Obour = `Identity/New Obour.png`).

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
4. **Mirrors kept identical by discipline only:** `apps/{portal,brokerage}/lib/search.ts`,
   `apps/{portal,brokerage}/app/thumb/[...path]/route.ts`, and now
   `apps/{portal,brokerage}/app/api/listings/alive/route.ts`. Change one → change both.
5. **Soft delete:** any new public listing read must respect `deletedAt: null` (use the central
   visibility helpers in `@noc/partner-portal`); the purge cleanup transaction is mirrored in the
   admin action + `ops/purge-deleted-listings.ts`.
6. **Owner decisions — don't re-litigate:** Card Title retired; both areas required for the reconcile
   auto-fill; transfer fee 180/م²; restore stays CLI-only; neighborhood map inheritance is
   explore-only; the gallery WhatsApp button is deliberately deleted; Outlook→spam is shared-IP
   reputation, not DNS.
7. **Never delete Settings `gsc_newobour`/`gsc_alsawarey`** — Google Search Console verification
   renders from them.
8. **elbarbary / «عقيد إسلام البربري»** is a real partner set to Al-Sawarey-login-only; his listings
   now show on both sites (via the decoupling), which is intended — the owner explicitly asked for it.

## Key files — where the latest-session work lives

- `apps/portal/lib/poster/generate.ts` — `POSTER_CARD_ORDER` (poster card order by section key).
- `apps/portal/lib/poster/render.ts` — poster SVG layout (row-major grid, map slot 1).
- `packages/partner-portal/src/visibility.ts` — the decoupled visibility helpers.
- `apps/portal/app/partner/(protected)/layout.tsx` — partner nav (عروضي / عروض الصواري).
- `packages/partner-portal/src/{Browse.tsx,AccountForm.tsx}` — view-only browse + reveal-password.
- `packages/ui/src/components/RecentlyViewed.tsx` + `apps/{portal,brokerage}/app/api/listings/alive/route.ts` — auto-prune dead cards.
- `apps/brokerage/lib/listings.ts` + `apps/portal/lib/listingCovers.ts` — 0-price + masterplan cover fallback.
- `packages/i18n/messages/{ar,en}.json` — the `seller` label.

## How to continue

Open a session in this folder (`C:\Claude\NOC`) — `CLAUDE.md` auto-loads. Say:

**"Read HANDOFF.md and continue this project."**

Expected workflow for every task (the owner expects the full cycle): build → typecheck/build →
commit (Arabic-safe heredoc message) → push → deploy via the runbook → **verify live**.
