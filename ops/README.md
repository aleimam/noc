# ops/ — server operations toolkit

Scripts + runbooks for the production VPS (`root@77.42.66.76`, AlmaLinux 9 + CWP).
Everything here runs **on the server**; pull the repo there first (`cd /root/noc && git pull`).
The big picture (deploy runbook, server map, gotchas) lives in the repo root **CLAUDE.md**.

## Runbooks

| Doc | What |
|---|---|
| `CLOUDFLARE.md` | Proxy cutover: owner dashboard checklist (Part C is the current step) + server prep (done) |
| `OFFSITE.md` | One-time off-site backup setup (owner enters details in `/admin/settings/backups` or here) |
| `RESTORE.md` | How to restore DB / uploads / .env from a backup (deliberately CLI-only) |
| `MAIL-DELIVERABILITY.md` | Outbound mail: Postfix→Brevo relay, SPF/DKIM/DMARC state, testing |
| `HARDENING.md` | SSH/firewall hardening (applied; kept as reference) |

## Scripts

| Script | What | Cron |
|---|---|---|
| `backup.sh` | DB dump + uploads archive + .env snapshot → `/root/backups`, rotation via `RETAIN_DAYS` | `/etc/cron.d/noc-backup` 02:30 |
| `offsite-backup.sh` | rsync-over-SSH mirror of `/root/backups/{db,uploads,config}` to the owner's server (key `/root/.ssh/noc_backup`). `--test` / `--install-cron`; skips quietly until `ops/offsite.env` is configured | `/etc/cron.d/noc-offsite` 03:30 |
| `backup-alert.sh` → `backup-alert.ts` | Health check: newest DB backup <26h + last off-site push OK, else email/SMS the owner (recipients in DB Setting `backup.alert`, editable at `/admin/settings/backups`) | `/etc/cron.d/noc-backup-alert` 04:00 |
| `analytics-rollup.sh` → `.ts` | Aggregate raw visits into `AnalyticsDaily` | `/etc/cron.d/noc-analytics-rollup` 03:05 |
| `analytics-prune.sh` → `.ts` | Retention prune of raw analytics | `/etc/cron.d/noc-analytics-prune` 03:15 |
| `price-snapshot.sh` → `.ts` | Monthly per-district price snapshot (avg EGP/m² from published listings + lands) feeding the `/price-index` trend. Idempotent; the admin "Snapshot now" button does the same | `/etc/cron.d/noc-price-snapshot` 03:20 on the 1st |
| `install-backups.sh` | One-time: backup tree + daily cron + first run | — |
| `cloudflare-realip.sh` | Regenerate Nginx real-IP + CSF ignore from Cloudflare's published ranges (already applied; rerun a few times/year) | — |
| `mail-relay-brevo.sh` | (Re)configure Postfix→Brevo relay creds (`/etc/postfix/sasl_passwd`). Use after rotating the Brevo key | — |
| `audit.sh` | Read-only security/ops snapshot; changes nothing | — |

## Config files (server-side, gitignored where secret)

| File | What |
|---|---|
| `nginx-noc.conf` | **Mirror of the live `/etc/nginx/conf.d/noc.conf`** (vhosts, ACME webroot locations, www→apex). Edit on the server, keep this copy in sync |
| `backup.env.example` → `ops/backup.env` | Backup overrides (`RETAIN_DAYS` is managed by the admin Backups page) |
| `offsite.env.example` → `ops/offsite.env` | Off-site target (host/user/port/path, enable, mirror) — managed by the admin Backups page |

## Notes

- Certificate renewal uses **certbot webroot** (`/usr/local/apache/autossl_tmp`) — the nginx
  authenticator does NOT work on this CWP box. Never re-run `certbot --nginx`.
- Postfix discards mail to the placeholder `yourdomain.com` (transport_maps) so hourly cron
  mail can't bounce through Brevo and damage sender reputation.
- `*.sh` are LF-forced via `.gitattributes`. Don't `chmod` tracked scripts on the server
  (file-mode diffs used to abort `git pull`; `core.fileMode false` is set as a guard).
- `ops/backup.env` + `ops/offsite.env` are gitignored (may hold credentials/targets).
