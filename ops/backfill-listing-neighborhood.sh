#!/usr/bin/env bash
# One-time backfill: set Listing.neighborhoodId from each listing's NEIGHBORHOOD attribute
# value where the geo FK is still NULL, so land / Al-Sawarey listings inherit area content
# (advantages / maps / updates / amenities). Idempotent — safe to re-run. Run once on prod
# after deploy. See ops/backfill-listing-neighborhood.ts for details.
set -euo pipefail
cd /root/noc
exec /usr/bin/npx dotenv -e .env -- tsx ops/backfill-listing-neighborhood.ts
