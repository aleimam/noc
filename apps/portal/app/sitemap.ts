import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';
import { newObourVisibility } from '@noc/partner-portal/visibility';
import { getModuleVisibility } from '../lib/modules';
import { marketHref } from '../lib/listings';
import { cityHref, districtHref, neighborhoodHref } from '../lib/geoHref';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const [vis, news, pages, listings, cities, districts, neighborhoods, conditions] = await Promise.all([
    getModuleVisibility(),
    prisma.news.findMany({ where: { publishedAt: { not: null } }, select: { id: true, updatedAt: true }, take: 500 }),
    prisma.page.findMany({ where: { brand: 'newobour', published: true }, select: { slug: true, updatedAt: true } }),
    prisma.listing.findMany({ where: { status: 'PUBLISHED', ...newObourVisibility() }, select: { id: true, updatedAt: true, adNumber: true, area: true, typeOption: { select: { nameEn: true } } }, take: 2000 }),
    prisma.city.findMany({ where: { isActive: true }, select: { id: true, key: true, updatedAt: true }, take: 100 }),
    prisma.district.findMany({ where: { isActive: true }, select: { id: true, key: true, updatedAt: true }, take: 500 }),
    prisma.neighborhood.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, updatedAt: true, district: { select: { nameAr: true } } }, take: 2000 }),
    prisma.buildingCondition.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const on = (key: string) => vis[key as keyof typeof vis] !== false;

  // Image sitemap (Google image extension): up to a few public gallery photos per listing.
  // Next 15 renders each entry's `images: string[]` as <image:image><image:loc>…. URLs must
  // be absolute; attachment paths are root-relative (/uploads/…).
  const listingIds = on('market') ? listings.map((l) => l.id) : [];
  const photoRows = listingIds.length
    ? await prisma.attachment.findMany({
        where: { ownerType: 'Listing', ownerId: { in: listingIds }, attributeId: null },
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true, path: true },
      })
    : [];
  const imagesByListing = new Map<string, string[]>();
  for (const r of photoRows) {
    if (!r.ownerId) continue;
    const arr = imagesByListing.get(r.ownerId) ?? [];
    if (arr.length < 3) arr.push(`${base}${r.path}`);
    imagesByListing.set(r.ownerId, arr);
  }

  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: 'daily', priority: 1 }];
  // module landing pages (only the enabled ones)
  const modulePaths: [string, string][] = [
    ['market', '/market'], ['explore', '/explore'], ['rationing', '/rationing'], ['news', '/news'], ['guide', '/guide'], ['priceIndex', '/price-index'],
  ];
  for (const [key, path] of modulePaths) if (on(key)) entries.push({ url: `${base}${path}`, changeFrequency: 'weekly', priority: 0.8 });

  // Individual market listings (with their gallery photos as image-sitemap entries)
  if (on('market'))
    for (const l of listings) {
      const images = imagesByListing.get(l.id);
      entries.push({
        url: `${base}${marketHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null })}`,
        lastModified: l.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
        ...(images?.length ? { images } : {}),
      });
    }
  // Explore: cities + districts + neighborhoods (canonical SEO URLs)
  if (on('explore')) {
    for (const c of cities) entries.push({ url: `${base}${cityHref(c)}`, lastModified: c.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
    for (const d of districts) entries.push({ url: `${base}${districtHref(d)}`, lastModified: d.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
    for (const n of neighborhoods) entries.push({ url: `${base}${neighborhoodHref(n)}`, lastModified: n.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
  }
  // Guide: building-conditions index + detail pages
  if (on('guide')) {
    entries.push({ url: `${base}/guide/conditions`, changeFrequency: 'monthly', priority: 0.5 });
    for (const c of conditions) entries.push({ url: `${base}/guide/conditions/${c.slug}`, lastModified: c.updatedAt, changeFrequency: 'monthly', priority: 0.5 });
  }
  // News details
  if (on('news')) for (const n of news) entries.push({ url: `${base}/news/${n.id}`, lastModified: n.updatedAt, priority: 0.6 });
  // Custom pages
  for (const p of pages) entries.push({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.4 });
  return entries;
}
