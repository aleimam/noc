#!/usr/bin/env bash
# Daily backup health check → emails/SMSes the owner if the newest backup is stale or the
# last off-site push failed. Recipients + on/off are set in Settings → Backups.
# Cron (04:00): /etc/cron.d/noc-backup-alert. Log: /root/backups/backup-alert.log
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/backup-alert.ts
