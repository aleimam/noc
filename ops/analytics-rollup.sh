#!/usr/bin/env bash
# Nightly analytics daily rollup wrapper (called by /etc/cron.d/noc-analytics-rollup).
# Aggregates raw visit data into AnalyticsDaily so trends survive the retention prune.
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/analytics-rollup.ts
