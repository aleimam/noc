/**
 * Purge soft-deleted listings older than LISTING_TRASH_DAYS (default 90).
 *
 * Listings deleted from the admin go to the trash (Listing.deletedAt) where they can be
 * restored from /admin/marketplace/listings/deleted. This nightly job makes the deletion
 * permanent once the retention window passes: EAV values, contact requests, wishlist items,
 * view days and building conditions cascade at the DB; negotiations + a source Land row are
 * SetNull. The loose polymorphic references (uploaded photos/documents + generated
 * poster/card images as Attachment rows, and the listing location map as an AreaMap) carry
 * no FK, so they are cleared explicitly per listing.
 * ⚠️ MIRROR of purgeListing() in apps/portal/.../marketplace/actions.ts — keep in sync.
 *
 * Run nightly by cron (/etc/cron.d/noc-purge-deleted).
 * Run manually:  cd /root/noc && npx dotenv -e .env -- tsx ops/purge-deleted-listings.ts
 */
import { prisma } from '@noc/db';

const DAYS = Math.max(7, Number(process.env.LISTING_TRASH_DAYS) || 90);

const BATCH = 200; // bound memory: a mass-delete could leave thousands of rows past the cutoff

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 86_400_000);
  let total = 0;
  // Fetch in bounded pages instead of one unbounded findMany. Each row is deleted in its own
  // transaction, so a page is never held open; we re-query after each page (deleted rows drop
  // out of the predicate, so `take` alone walks the whole backlog without an offset).
  for (;;) {
    const rows = await prisma.listing.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, title: true, deletedAt: true },
      orderBy: { deletedAt: 'asc' },
      take: BATCH,
    });
    if (rows.length === 0) break;
    for (const l of rows) {
      await prisma.$transaction([
        // 'ListingPaper' too: official allocation-letter / sale-mandate photos ride the polymorphic
        // Attachment with no FK to Listing, so deleting the listing cannot cascade to them. Omitting
        // it left those rows (and their files) orphaned forever with an unresolvable owner id.
        // MIRRORED in purgeListing() in admin marketplace actions — change both together.
        prisma.attachment.deleteMany({ where: { ownerId: l.id, ownerType: { in: ['Listing', 'ListingPoster', 'ListingPaper'] } } }),
        prisma.areaMap.deleteMany({ where: { level: 'listing', areaId: l.id } }),
        prisma.listing.delete({ where: { id: l.id } }),
      ]);
      console.log(`purged ${l.id} «${l.title}» (deleted ${l.deletedAt?.toISOString().slice(0, 10)})`);
      total++;
    }
    if (rows.length < BATCH) break;
  }
  console.log(`purge-deleted-listings: ${total} listing(s) purged (retention ${DAYS}d)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
