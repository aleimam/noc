# CLAUDE.md — NOC platform (read me first)

Master onboarding for anyone (human or Claude session) picking up this repo. It captures the
architecture, the production runbook, and every hard-won gotcha. Deeper docs are linked at the
bottom. Last full update: **2026-07-11**.

## What this is

One Turborepo monorepo → **two live sites sharing one MariaDB backend**:

| App | Domain | Brand | Port (dev+prod) |
|---|---|---|---|
| `apps/portal` | **newobour.com** | العبور الجديد (New Obour) — free community portal | 3001 |
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

## Feature map (all live in production)

| Module | Where | Notes |
|---|---|---|
| Marketplace (listings) | portal `/market`, admin `/admin/marketplace` | EAV + classifiers + moderation queue (PENDING→PUBLISHED) |
| Al Sawarey storefront | brokerage `/` `/listings` | display-only; `showOnBrokerage` + Type/Purpose gates; customer OTP login, wishlist |
| **Partner portal (multi-site)** | `/partner` on BOTH domains | 100% shared via `@noc/partner-portal`; per-partner site access (`Owner.siteNewObour/siteAlsawary`); partner listings show only on enabled sites; lean listing form both sides; login = password OR OTP (SMS/email) |
| Rationing (كشوف التقنين) | portal `/rationing`, admin sheets/scans | Excel import, soft Arabic search, quotas by security level |
| Lands/geo explorer | portal `/explore` | city→district→neighborhood→block, masterplans, advantages, amenities. Neighborhood inherits district LOCATION map if it has none (explore only, never listings) |
| Calculator | portal `/calculator` | area + تصالح cost calc, admin-editable rates |
| News / Guide / Price index / Owner profiles | portal | public surfaces |
| Web analytics | admin `/admin/analytics` | first-party: sessions, events, funnel, Web Vitals, cohorts, rollups, saved views |
| Backups | admin `/admin/settings/backups` | see server map above |
| Appearance/theming | admin settings | per-site colors/fonts via Setting `theme.<brand>` |
| Security posture | admin settings | `security.level` LIGHT/MEDIUM/HIGH gates scans/maps/quotas |

## Current state & pending (as of 2026-07-11)

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
   Owners → its PartnerPortalPanel). **Delete this owner+user after testing.**
5. `/code-review ultra` — owner-triggered, billed; fold findings into `security.md` §7.

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
