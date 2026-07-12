#!/usr/bin/env bash
# Backfill Neighborhood.order from the number in each neighborhood's Arabic name (مجاورة 5 → 5),
# so every geo list/dropdown/picker sorts numerically instead of by id or alphabetically.
# Handles ASCII, Arabic-Indic (٠-٩) and Persian (۰-۹) digits. Idempotent — safe to re-run.
# See ops/backfill-neighborhood-order.ts for details.
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/backfill-neighborhood-order.ts
