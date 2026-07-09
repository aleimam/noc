#!/usr/bin/env bash
# Nightly analytics retention prune wrapper (called by /etc/cron.d/noc-analytics-prune).
# Deletes visit data older than ANALYTICS_RETENTION_DAYS (default 90; set in .env to override).
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/analytics-prune.ts
