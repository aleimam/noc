#!/usr/bin/env bash
# Monthly price-index snapshot wrapper (called by /etc/cron.d/noc-price-snapshot).
# Records per-district avg EGP/m² so /price-index accumulates a trend.
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/price-snapshot.ts
