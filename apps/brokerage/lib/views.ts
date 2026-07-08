import { prisma } from '@noc/db';

/** Count one public listing view: all-time counter + today's rollup (partner
 *  analytics). Naive by design (no dedupe) and must never break the page. */
export async function trackListingView(listingId: string): Promise<void> {
  try {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    await prisma.$transaction([
      prisma.listing.update({ where: { id: listingId }, data: { views: { increment: 1 } } }),
      prisma.listingViewDay.upsert({
        where: { listingId_date: { listingId, date: day } },
        update: { count: { increment: 1 } },
        create: { listingId, date: day, count: 1 },
      }),
    ]);
  } catch {
    /* views must never break the page */
  }
}
