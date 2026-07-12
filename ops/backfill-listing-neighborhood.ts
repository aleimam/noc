/**
 * One-time backfill — populate Listing.neighborhoodId from each listing's NEIGHBORHOOD
 * marketplace attribute value (ListingValue.text = a Neighborhood id) wherever the geo FK
 * is still NULL.
 *
 * Why: land / Al-Sawarey listings capture their area as a marketplace attribute of type
 * NEIGHBORHOOD, not via a geo picker. The inheritance helpers (advantages / maps / updates /
 * amenities) all key off Listing.neighborhoodId, so a listing with only the attribute set —
 * but a NULL FK — inherits nothing. The save actions now keep the FK in sync going forward
 * (apps/portal/app/account/listings/actions.ts + packages/partner-portal/src/listingSave.ts);
 * this fixes the rows created before that.
 *
 * Idempotent — only touches rows where neighborhoodId IS NULL and the attribute value points
 * at a Neighborhood that still exists. Re-running changes nothing. Logs the count.
 *
 * Usage:  npx dotenv -e .env -- tsx ops/backfill-listing-neighborhood.ts
 */
import { prisma } from '@noc/db';

async function main() {
  const stamp = () => new Date().toISOString();

  // Attributes of type NEIGHBORHOOD — their ListingValue.text carries a Neighborhood id.
  const nbAttrs = await prisma.attribute.findMany({ where: { type: 'NEIGHBORHOOD' }, select: { id: true } });
  const nbAttrIds = nbAttrs.map((a) => a.id);
  if (!nbAttrIds.length) {
    console.log(`[${stamp()}] backfill: no NEIGHBORHOOD attributes defined — nothing to do`);
    return;
  }

  // NEIGHBORHOOD values on listings whose geo FK is still NULL.
  const rows = await prisma.listingValue.findMany({
    where: {
      attributeId: { in: nbAttrIds },
      text: { not: null },
      listing: { is: { neighborhoodId: null } },
    },
    select: { listingId: true, text: true },
  });

  // One candidate neighborhood id per listing (first non-empty wins).
  const wanted = new Map<string, string>(); // listingId -> neighborhoodId
  for (const r of rows) {
    const id = r.text?.trim();
    if (id && !wanted.has(r.listingId)) wanted.set(r.listingId, id);
  }
  if (!wanted.size) {
    console.log(`[${stamp()}] backfill: no NULL-FK listings carry a NEIGHBORHOOD value — nothing to do`);
    return;
  }

  // Keep only ids that reference a Neighborhood that still exists.
  const nbIds = [...new Set(wanted.values())];
  const existing = new Set(
    (await prisma.neighborhood.findMany({ where: { id: { in: nbIds } }, select: { id: true } })).map((n) => n.id),
  );

  let updated = 0;
  let skipped = 0;
  for (const [listingId, neighborhoodId] of wanted) {
    if (!existing.has(neighborhoodId)) {
      skipped++;
      continue;
    }
    await prisma.listing.update({ where: { id: listingId }, data: { neighborhoodId } });
    updated++;
  }

  console.log(
    `[${stamp()}] backfill: ${updated} listing(s) linked to a neighborhood` +
      (skipped ? `; ${skipped} skipped (attribute value pointed at a missing neighborhood)` : ''),
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
