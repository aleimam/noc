import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';
import { listingHref } from '../lib/listings';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  const [lands, pages] = await Promise.all([
    prisma.listing.findMany({ where: { showOnBrokerage: true, status: { in: ['PUBLISHED', 'SOLD'] }, deletedAt: null }, select: { id: true, adNumber: true, area: true, updatedAt: true, typeOption: { select: { nameEn: true } } } }),
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
