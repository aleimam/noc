#!/usr/bin/env bash
# Make the listing city (المدينة) a mandatory basic detail, restricted to New Obour City:
# ensure the `city` attribute is active + applicable to every type, keep only New Obour active,
# and backfill the city value on any listing that lacks it. Idempotent — safe to re-run.
# See ops/city-mandatory.ts for details.
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/city-mandatory.ts
