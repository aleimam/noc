# Project Handoff — NOC platform (newobour.com + alsawarey.com)

_Last updated: 2026-07-16 03:10 EDT · Written so a new Claude session (on any account) can continue this project._

> **Read `CLAUDE.md` first — it is the master onboarding doc** (architecture, the production
> deploy runbook with every gotcha, the server map, feature map, and the owner-blocked list).
> This HANDOFF only covers **what's mid-flight right now** and how to pick it up. Where the two
> disagree, CLAUDE.md wins on architecture; this file wins on "what was I doing last".

## What this project is

One Turborepo monorepo powering **two live production websites** that share one MariaDB backend:
**newobour.com** (`apps/portal`) is a free Arabic community portal for New Obour City (land
explorer, rationing lists, marketplace, calculator) and **alsawarey.com** (`apps/brokerage`) is a
commercial land-brokerage storefront. Both are managed from a single admin inside the portal.
Users are low-literacy/low-tech on phones — the design rule is *biggest, simplest, most explicit*.

## Current status

**Live, healthy, and fully deployed.** Local `main` and production are both at **`eaf3708`**;
both pm2 apps online; all public surfaces returning 200. The platform is feature-rich and stable —
recent months added the multi-site partner portal, Search Intelligence, SEO phases, a backups
admin suite, the rationing watcher workflow, and a watermark overhaul.

**There is ONE unfinished feature in the working tree** (uncommitted — see next section). The tree
**does build cleanly** (`npm run build` → 3/3), so you are not inheriting a broken state — just a
half-wired feature.

## Done in the latest session

This session (2026-07-11, then a review pass on 2026-07-16) did **infrastructure and
documentation**, not product features:

- **Security hardening round 3** (commit `89aa435`, all verified live): disabled + firewalled
  **pure-ftpd** (unused, and it was under active brute-force) and **BIND/named** (no delegated
  zones — DNS is Cloudflare); trimmed CSF to web + SSH + mail + CWP-panel only; enabled
  **TLSv1.3**; `server_tokens off`; `.env` → 600; **bound both Next apps to 127.0.0.1**.
  Documented in `security.md` §5 + findings **F9–F12**.
- **Kernel reboot** (owner-approved): now on `5.14.0-687.23.1`, `needs-restarting` clear, all
  services and pm2 apps returned unattended (~90s downtime).
- **Documentation pass** (commit `3d02bfc`): **created `CLAUDE.md`** (the master onboarding file,
  auto-loaded by Claude Code in every session on any account), rewrote `ops/README.md`, refreshed
  `ROADMAP.md`/`README.md`/`DEPLOY.md`. This existed because project knowledge previously lived
  only in one account's local memory.
- **Reviewed the other account's work** (39 commits, ~9.5k lines: Search Intelligence, RBAC
  section split, SEO, price heatmap, geo directory, the 07-13 admin batch). **Verdict: no defects
  found — nothing needed fixing.** Verified the house invariants all hold (search.ts mirrors are
  functionally identical, all 7 new migrations are PascalCase, all 5 new public endpoints are
  rate-limited, the lead inbox is `analytics:MANAGE`-gated, the 12-section RBAC split is live on
  prod with zero lockout, and the calculator's 330→180 fee change is correct in **both** the code
  default and the live prod Setting).
- **This handoff**: fixed a stale line in `security.md` (it claimed the reboot was still pending),
  added the hardening/attack-surface facts to the `CLAUDE.md` server map, and wrote this file.

## In progress / not finished

### ⚠️ Neighborhood "available areas" = manual list MERGED with plot-derived sizes

**Owner's rule (2026-07-15):** every plot (listing) placed in a neighborhood should contribute its
standard/allocated size to that neighborhood's displayed area list — merged with the manually
curated `Neighborhood.areas`. Only `PUBLISHED` + `SOLD` plots count. Computed live at read time
(no schema column, so it's always current).

**Three uncommitted files** (`git status` shows them):

| File | State |
|---|---|
| `apps/portal/lib/neighborhoodAreas.ts` | ✅ **NEW + complete.** Exports `derivePlotAreas(neighborhoodIds[])` → `Map<nbId, number[]>` (batch-capable by design) and `mergeAreas(manual, derived)` → unique ascending union. Uses «أصل المساحة» (`original_area`) when present, else rounds the actual area to the nearest standard bucket. |
| `apps/portal/app/explore/neighborhood/[id]/page.tsx` | ✅ **DONE + wired.** Lines ~105–106 call `derivePlotAreas([id])` + `mergeAreas(...)`. |
| `apps/portal/app/explore/district/[id]/page.tsx` | ⚠️ **HALF-DONE — this is exactly where work stopped.** The import was added (line 16) but **is never used**; the page still reads raw `n.areas`. |

**To finish the district page** — it needs the merge applied in **two** places, fed by **one**
batched call (that's why `derivePlotAreas` takes an array):

1. Call once near the top, after `d.neighborhoods` is loaded:
   `const derivedMap = await derivePlotAreas(d.neighborhoods.map((n) => n.id));`
2. **Line ~72** — `nbAreas` (the district-level aggregate of all neighborhood areas) currently
   flatMaps raw `n.areas`; it should flatMap `mergeAreas(n.areas ?? [], derivedMap.get(n.id) ?? [])`.
3. **Line ~124** — the per-neighborhood card does `const areas = (n.areas as number[] | null) ?? []`;
   it should be `mergeAreas((n.areas as number[] | null) ?? [], derivedMap.get(n.id) ?? [])`.
   (Line ~128 renders it, and respects an `assortedAreas` flag — leave that behavior alone.)

Then: `npm run build`, commit, and deploy with the standard runbook in `CLAUDE.md`. Worth a quick
sanity check on a real district page that the areas shown now include plot sizes.

**Note:** the unused import currently produces only a lint warning — the build passes — so nothing
is broken; the feature is just inconsistent between the two pages until this is done.

## Next steps

1. **Finish the district page merge** (exact instructions above), build, commit, deploy, verify.
2. **Partner portal UI click-test** — the last unverified piece of a completed feature. Log in as
   the `testpartner` account on **both** newobour.com/partner and alsawarey.com/partner, submit
   the listing form once, confirm it lands PENDING in admin moderation. **Then delete that test
   owner+user.** (Backend was already verified end-to-end by script; only the browser UI is
   unproven.)
3. **Cloudflare proxy flip (Part C)** — owner's dashboard task, ~10 min, fully prepped and
   pre-flighted. Ordered checklist in `ops/CLOUDFLARE.md`. Biggest remaining security win.
4. **Off-site backup target** — owner enters host/user/port/path at `/admin/settings/backups`,
   adds the shown VPS public key to that server's `authorized_keys`, clicks Test. Script + cron
   are already installed and will activate automatically.
5. **Rotate the Brevo SMTP key** (it was pasted into a chat once), then re-apply via
   `ops/mail-relay-brevo.sh`.
6. Optional/when wanted: enable the **Price Index** module toggle; run `/code-review ultra`.

## Key files — where everything is

**Start here**
- `CLAUDE.md` — **the master doc.** Architecture, repo map, dev quickstart, the deploy runbook
  with all six gotchas, the production server map, architecture rules, feature map, and the
  owner-blocked list. Auto-loads in every Claude Code session. Read this first.
- `HANDOFF.md` — this file (what's mid-flight).

**The unfinished feature**
- `apps/portal/lib/neighborhoodAreas.ts` — new, complete helper (see above).
- `apps/portal/app/explore/neighborhood/[id]/page.tsx` — done reference implementation.
- `apps/portal/app/explore/district/[id]/page.tsx` — **needs finishing.**

**Other docs**
- `ops/README.md` — every server script, runbook, and cron, indexed.
- `ops/CLOUDFLARE.md` — the proxy-flip checklist (next owner task).
- `ops/OFFSITE.md` · `ops/RESTORE.md` · `ops/MAIL-DELIVERABILITY.md` · `ops/HARDENING.md` ·
  `ops/SEO-REGISTRATION.md` — task runbooks.
- `ops/nginx-noc.conf` — mirror of the live nginx vhost config (disaster recovery).
- `security.md` — security standard + posture + findings register F1–F12.
- `ROADMAP.md` — feature scoping + status log. `README.md` — quickstart. `DEPLOY.md` — original
  server-build narrative (superseded by CLAUDE.md where they differ).

**Code layout** — `apps/portal` (newobour.com + the one `/admin`), `apps/brokerage`
(alsawarey.com), `packages/{db,auth,ui,partner-portal,mail,sms,analytics,config,i18n}`.
Full map in CLAUDE.md.

**Root reference material (not code, left as-is):** `NOC00-02.docx`, `SMS-Partners.docx`,
`NewObour Design System/`, `NewObour Design System 2.zip`, `input data/`, `Identity/` (brand
assets — the real logos are `Identity/1000X1000.png` for ALSWARY and `Identity/New Obour.png`).

## Important context, decisions & gotchas

**Deploy — read the runbook in CLAUDE.md before deploying.** The two that have burned real
deploys: (1) always `git checkout -- package-lock.json` before `git pull --ff-only`, because a
dirty tree makes the pull abort and the chained `&& build && reload` then silently deploys STALE
code while reporting success — **always verify `git log --oneline -1` on the server afterwards**;
(2) `db:release` must NEVER seed (a seed once wiped the admin's attribute organization).

**Owner decisions — don't re-litigate:**
- Card Title was **retired** (cards use the listing title); the DB column stays dormant on purpose.
- The reconciliation auto-calc requires **both** «أصل المساحة» and «المساحة» — the standard is
  never derived. Deliberate.
- Ownership-transfer fee is **180/م²** (the Authority halved it) — correct in both the code
  default and the live prod Setting.
- Restore stays **CLI-only** by design (too dangerous as a button) — `ops/RESTORE.md`.
- A neighborhood with no location map inherits its **district's** map on `/explore` only —
  **never** in listings.

**Mail deliverability — settled, do not chase:** both domains are fully Brevo-authenticated
(SPF + DKIM verified). Gmail → inbox. **Outlook/live.com → spam** purely from shared-IP
reputation. This is not fixable with more DNS. Backup alerts therefore go to **SMS + Gmail +
Outlook**, and SMS is the reliable channel.

**Fragile things to avoid breaking:**
- `apps/portal/lib/search.ts` and `apps/brokerage/lib/search.ts` are **mirrors** — keep them
  identical (there's no build-time guard; it's discipline only. *Suggested improvement: add a
  script that diffs them and fails the build on drift.*)
- Any new shared package with Tailwind classes must be added to **both** apps' `globals.css`
  `@source` globs, or its classes silently purge.
- Don't rebind the Next apps to 0.0.0.0 (see the hardening note in CLAUDE.md).
- Never run `certbot --nginx` on this box — renewal is **webroot**-based (the nginx authenticator
  does not work here and would break renewal).

**Credentials / secrets** — never in this repo. Production secrets live in `/root/noc/.env` on the
server (mode 600). SSH is key-only: `ssh noc` from the owner's PC. Panel recovery: CWP on :2087.
The `testpartner` password is resettable from the admin panel (Owners → the owner editor's
partner card).

## How to continue

Open a new session on the other account, connect this folder (`C:\Claude\NOC`), and say:

**"Read HANDOFF.md and continue this project."**
