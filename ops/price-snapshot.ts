/**
 * Monthly price-index snapshot — records one PriceSnapshot row per district-with-data
 * (avg EGP/m² across published Listings + Lands) so /price-index can show a 6-month
 * trend. History accumulates from the first run; it cannot be backfilled.
 *
 * Runs on the 1st of each month via /etc/cron.d/noc-price-snapshot; safe to re-run
 * (idempotent — overwrites the current month's rows). The admin "Snapshot now" button
 * does the same thing on demand.
 *
 * Usage:  npx dotenv -e .env -- tsx ops/price-snapshot.ts
 */
import { snapshotPrices, currentMonth } from '../apps/portal/lib/priceIndex';

async function main() {
  const month = currentMonth();
  const count = await snapshotPrices(month);
  console.log(`[${new Date().toISOString()}] price snapshot ${month}: ${count} district row(s) written`);
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e); process.exit(1); },
);
