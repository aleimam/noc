import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';
import { listingHref, STOREFRONT_STATUS } from '../lib/listings';

export const dynamic = 'force-dynamic';

/** Hard ceiling on sitemap entries. The route previously loaded EVERY qualifying listing and
 *  then EVERY attachment for that whole id set, with no `take` anywhere, and rebuilt the entire
 *  XML in memory on each request (no caching, force-dynamic) — so a crawler hitting
 *  /sitemap.xml repeatedly scaled straight with inventory. 5k URLs is well inside the 50k
 *  sitemap limit; past that we'd partition into a sitemap index. */
const MAX_URLS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  const [lands, pages] = await Promise.all([
    // Use the SAME predicate as the live catalogue. Hard-coding `showOnBrokerage` omitted
    // partner-owned listings that ARE visible, and emitted toggled rows whose Type/Purpose is
    // no longer allowed — whose detail URLs 404 for the crawler.
    prisma.listing.findMany({
      where: STOREFRONT_STATUS,
      orderBy: { updatedAt: 'desc' },
      take: MAX_URLS,
      select: { id: true, adNumber: true, area: true, updatedAt: true, typeOption: { select: { nameEn: true } } },
    }),
    prisma.page.findMany({ where: { brand: 'alsawarey', published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  // Image sitemap (Google image extension): up to a few public gallery photos per land.
  // Next 15 renders each entry's `images: string[]` as <image:image><image:loc>…; URLs must
  // be absolute (attachment paths are root-relative /uploads/…).
  const landIds = lands.map((l) => l.id);
  const photoRows = landIds.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'Listing', ownerId: { in: landIds }, attributeId: null },
        orderBy: { createdAt: 'asc' },
        // Bounded: we keep at most 3 images per land below, so there is no reason to
        // materialize every gallery photo for the entire catalogue first.
        take: MAX_URLS * 3,
        select: { ownerId: true, path: true },
      })
    : [];
  const imagesByLand = new Map<string, string[]>();
  for (const r of photoRows) {
    if (!r.ownerId) continue;
    const arr = imagesByLand.get(r.ownerId) ?? [];
    if (arr.length < 3) arr.push(`${base}${r.path}`);
    imagesByLand.set(r.ownerId, arr);
  }

  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/sell`, changeFrequency: 'monthly', priority: 0.7 },
    ...lands.map((l) => {
      const images = imagesByLand.get(l.id);
      return {
        url: `${base}${listingHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null })}`,
        lastModified: l.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        ...(images?.length ? { images } : {}),
      };
    }),
    ...pages.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}
