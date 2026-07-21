# ops/ — server operations toolkit

Scripts + runbooks for the production VPS (`root@77.42.66.76`, AlmaLinux 9 + CWP).
Everything here runs **on the server**; pull the repo there first (`cd /root/noc && git pull`).
The big picture (deploy runbook, server map, gotchas) lives in the repo root **CLAUDE.md**.

## Runbooks

| Doc | What |
|---|---|
| `CLOUDFLARE.md` | Proxy cutover: owner dashboard checklist (Part C is the current step) + server prep (done) |
| `RESTORE.md` | How to restore DB / uploads / .env from a backup (deliberately CLI-only) |
| `MAIL-DELIVERABILITY.md` | Outbound mail: Postfix→Brevo relay, SPF/DKIM/DMARC state, testing |
| `SEO-REGISTRATION.md` | One-time search-engine registration: GSC/Bing/Yandex verify via admin Settings, sitemaps, GA4, Business Profile, Egyptian portals (IndexNow pings are automatic) |
| `HARDENING.md` | SSH/firewall hardening (applied; kept as reference) |

## Scripts

| Script | What | Cron |
|---|---|---|
| `backup.sh` | DB dump + uploads archive + .env snapshot → `/root/backups`, rotation via `RETAIN_DAYS` | `/etc/cron.d/noc-backup` 02:30 |
| `backup-alert.sh` → `backup-alert.ts` | Health check: newest DB backup <26h, else email/SMS the owner (recipients in DB Setting `backup.alert`, editable at `/admin/settings/backups`) | `/etc/cron.d/noc-backup-alert` 04:00 |
| `analytics-rollup.sh` → `.ts` | Aggregate raw visits into `AnalyticsDaily` | `/etc/cron.d/noc-analytics-rollup` 03:05 |
| `analytics-prune.sh` → `.ts` | Retention prune of raw analytics | `/etc/cron.d/noc-analytics-prune` 03:15 |
| `price-snapshot.sh` → `.ts` | Monthly per-district price snapshot (avg EGP/m² from published listings + lands) feeding the `/price-index` trend. Idempotent; the admin "Snapshot now" button does the same | `/etc/cron.d/noc-price-snapshot` 03:20 on the 1st |
| `purge-deleted-listings.ts` | Hard-deletes listings soft-deleted (trashed) more than `LISTING_TRASH_DAYS` (default 90) days ago — same cleanup transaction as the admin trash page's purge action (attachments + area maps + row). Log: `/var/log/noc-purge-deleted.log` | `/etc/cron.d/noc-purge-deleted` 03:40 |
| `backup-tick.sh` → `backup-tick.ts` | **Tiered OFF-SITE backup** tick (SFTP → Hetzner Storage Box sub-account `u635384-sub6`). The APP decides which levels are due (`packages/backup` logic, DB-driven), so the cron just ticks. `--install-cron` schedules it every 10 min. Levels/retention/destination are edited at `/admin/settings/backups`. Log: `/root/backups/backup-tick.log` | `/etc/cron.d/noc-backup-tick` every 10 min |
| `install-backups.sh` | One-time: backup tree + daily cron + first run | — |
| `cloudflare-realip.sh` | Regenerate Nginx real-IP + CSF ignore from Cloudflare's published ranges (already applied; rerun a few times/year) | — |
| `mail-relay-brevo.sh` | (Re)configure Postfix→Brevo relay creds (`/etc/postfix/sasl_passwd`). Use after rotating the Brevo key | — |
| `audit.sh` | Read-only security/ops snapshot; changes nothing | — |
| `city-mandatory.sh` → `.ts` | Make the listing city (المدينة) mandatory + New-Obour-only: activates the `city` attribute, links it to every Type, keeps only New Obour active, backfills the value on old listings. Idempotent; run once after the city-mandatory deploy | — |

## Config files (server-side, gitignored where secret)

| File | What |
|---|---|
| `nginx-noc.conf` | **Mirror of the live `/etc/nginx/conf.d/noc.conf`** (vhosts, ACME webroot locations, www→apex). Edit on the server, keep this copy in sync |
| `backup.env.example` → `ops/backup.env` | Backup overrides (`RETAIN_DAYS` is managed by the admin Backups page) |

## Notes

- Certificate renewal uses **certbot webroot** (`/usr/local/apache/autossl_tmp`) — the nginx
  authenticator does NOT work on this CWP box. Never re-run `certbot --nginx`.
- Postfix discards mail to the placeholder `yourdomain.com` (transport_maps) so hourly cron
  mail can't bounce through Brevo and damage sender reputation.
- `*.sh` are LF-forced via `.gitattributes`. Don't `chmod` tracked scripts on the server
  (file-mode diffs used to abort `git pull`; `core.fileMode false` is set as a guard).
- `ops/backup.env` is gitignored (may hold credentials/overrides).
- The old rsync off-site backup (`offsite-backup.sh`, `OFFSITE.md`, `ops/offsite.env`, the
  `noc-offsite` cron) was retired 2026-07-21 — off-site backup is now the tiered SFTP module
  (`backup-tick.ts` + `packages/backup`). The LOCAL nightly `backup.sh` is deliberately kept.
