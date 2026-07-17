# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-17 · Written so a new Claude session (on any account, same device) can continue this project._

> **Read `CLAUDE.md` first — it is the master onboarding doc** (architecture, the production
> deploy runbook with every gotcha, the server map, feature map, architecture rules, and the
> owner-blocked list; last full update 2026-07-17 — same day as this file). This HANDOFF only
> covers **session-transition facts**: what state you're inheriting and what lives on this
> device but outside the repo.

## What this project is

One Turborepo monorepo powering **two live production websites** that share one MariaDB backend:
**newobour.com** (`apps/portal`) is a free Arabic community portal for New Obour City (land
explorer, rationing lists, marketplace, calculator) and **alsawarey.com** (`apps/brokerage`) is a
commercial land-brokerage storefront. Both are managed from a single admin inside the portal.
Users are low-literacy/low-tech on phones — the design rule is *biggest, simplest, most explicit*.

## Current status — NOTHING is mid-flight

**Live, healthy, fully deployed, clean tree.** Local `main` and production are both at
**`df78560`** (verified 2026-07-17). Both pm2 apps online. Every feature requested to date is
shipped, deployed, and live-verified — there is **no half-finished work** in the tree (the
build passes 3/3; `git status` is clean).

The complete change log for 2026-07-15→17 (hero gallery + photo analytics, thumbnail pipeline,
soft delete + 90-day trash, auto-save drafts, admin quick-add + recent-features grid, city
detail/edit split, watermark brand tabs, Al Sawarey review round, SEO descriptions + Google
Search Console, WhatsApp-photo-button removal, zero-result search review) is in
`CLAUDE.md` → *Current state & pending*.

## What lives on this device but NOT in the repo

These carry over automatically if the new account runs under the **same Windows user** on this
PC; if it's a different Windows profile, copy/recreate them:

| Thing | Where | Notes |
|---|---|---|
| Local env | `C:\Claude\NOC\.env` | gitignored; copy of `.env.example` + local values. Prod secrets live only in `/root/noc/.env` on the server (600). |
| Dev database | `C:\Claude\NOC\.devdb\` | portable MariaDB started by `npm run db:start`; gitignored but on disk, survives account switch. |
| SSH access | `~/.ssh/config` alias **`noc`** → `root@77.42.66.76` (key-only) | Deploys depend on `ssh noc` working. Per-Windows-user, not per-Claude-account. |
| Claude auto-memory | `C:\Users\aleim\.claude\projects\C--Claude-NOC\memory\` | Convenience only — **everything essential has been folded into `CLAUDE.md`**, so losing it costs nothing. If it loads, treat it as background hints. |
| Chat history | previous account's sessions | Does NOT carry. That's why CLAUDE.md + this file exist. |

Root reference material (in the folder, not code): `NOC00-02.docx`, `SMS-Partners.docx`,
`NewObour Design System/`, `input data/`, `Identity/` (real logos: ALSWARY =
`Identity/1000X1000.png`, New Obour = `Identity/New Obour.png`).

## Next steps (ALL owner-action — nothing is dev-blocked)

Full detail in `CLAUDE.md` → owner-blocked list. Short version, roughly by effort:

1. **Partner portal click-test** (5 min) — log in as `testpartner` on both `/partner` sites,
   submit the lean form once, confirm PENDING in moderation. **Then delete the test owner+user.**
2. **Off-site backups** (10 min) — `/admin/settings/backups`: enter host/user/port/path, add the
   shown VPS pubkey to the remote's `authorized_keys`, click Test. Cron already installed.
3. **Rotate the Brevo SMTP key**, then re-apply via `ops/mail-relay-brevo.sh`.
4. **Price Index toggle** — Settings → Modules → مؤشر الأسعار, whenever wanted.
5. **Cloudflare proxy flip (Part C)** — biggest remaining security win; ordered checklist in
   `ops/CLOUDFLARE.md`; fully pre-flighted, grey-cloud is the instant rollback.
6. **English content entry** (owner paused "later") — `/sell` page + storefront hero
   title/subtitle + hero image, all in the admin Storefront editor.
7. **~2026-07-23: GSC check-up** — coverage on both domains + alsawarey sitemap → Success.
8. `/code-review ultra` whenever the owner wants it (billed); fold findings into `security.md` §7.

Also: revisit `/admin/analytics/search` zero-result terms once real traffic accumulates
(reviewed 2026-07-17 — only 12 searches so far, nothing actionable, synonym dictionary empty).

## The five things most likely to bite you

1. **The deploy runbook gotchas** (CLAUDE.md §deploy — memorize): `git checkout --
   package-lock.json` BEFORE pulling, and **always verify `git log --oneline -1` on the server
   afterwards** — a dirty tree makes the pull abort while the chained build "succeeds" on stale
   code. `db:release` NEVER seeds. Env changes need `pm2 restart ecosystem.config.js --update-env`.
2. **Mirrors kept identical by discipline only:** `apps/{portal,brokerage}/lib/search.ts` AND
   `apps/{portal,brokerage}/app/thumb/[...path]/route.ts`. Change one → change both.
3. **Soft delete:** any new public listing read must respect `deletedAt: null` (use the central
   visibility helpers in `@noc/partner-portal`); the purge cleanup transaction is mirrored in the
   admin action + `ops/purge-deleted-listings.ts`.
4. **Owner decisions — don't re-litigate:** Card Title retired; both areas required for the
   reconcile auto-fill; transfer fee 180/م²; restore stays CLI-only; neighborhood map inheritance
   is explore-only; the gallery WhatsApp button is deliberately deleted (don't re-add);
   Outlook→spam is shared-IP reputation, not DNS — don't chase it.
5. **Never delete Settings `gsc_newobour`/`gsc_alsawarey`** — Google Search Console verification
   renders from them.

## How to continue

Open a session in this folder (`C:\Claude\NOC`) — `CLAUDE.md` auto-loads. Say:

**"Read HANDOFF.md and continue this project."**

Expected workflow for every task (the owner expects the full cycle): build → typecheck/build →
commit (Arabic-safe heredoc message) → push → deploy via the runbook → **verify live**.
