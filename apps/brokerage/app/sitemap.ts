import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  const [lands, pages] = await Promise.all([
    prisma.listing.findMany({ where: { showOnBrokerage: true, status: { in: ['PUBLISHED', 'SOLD'] } }, select: { id: true, updatedAt: true } }),
    prisma.page.findMany({ where: { brand: 'alsawarey', published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/listings`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/sell`, changeFrequency: 'monthly', priority: 0.7 },
    ...lands.map((l) => ({ url: `${base}/listings/${l.id}`, lastModified: l.updatedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...pages.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}
