import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';
import { getModuleVisibility } from '../lib/modules';
import { marketHref } from '../lib/listings';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const [vis, news, pages, listings, districts, neighborhoods, conditions] = await Promise.all([
    getModuleVisibility(),
    prisma.news.findMany({ where: { publishedAt: { not: null } }, select: { id: true, updatedAt: true }, take: 500 }),
    prisma.page.findMany({ where: { brand: 'newobour', published: true }, select: { slug: true, updatedAt: true } }),
    prisma.listing.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, updatedAt: true, adNumber: true, area: true, typeOption: { select: { nameEn: true } } }, take: 2000 }),
    prisma.district.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true } }),
    prisma.neighborhood.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true } }),
    prisma.buildingCondition.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const on = (key: string) => vis[key as keyof typeof vis] !== false;

  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: 'daily', priority: 1 }];
  // module landing pages (only the enabled ones)
  const modulePaths: [string, string][] = [
    ['market', '/market'], ['explore', '/explore'], ['rationing', '/rationing'], ['news', '/news'], ['guide', '/guide'], ['priceIndex', '/price-index'],
  ];
  for (const [key, path] of modulePaths) if (on(key)) entries.push({ url: `${base}${path}`, changeFrequency: 'weekly', priority: 0.8 });

  // Individual market listings
  if (on('market')) for (const l of listings) entries.push({ url: `${base}${marketHref({ id: l.id, adNumber: l.adNumber, typeEn: l.typeOption?.nameEn ?? null, area: l.area != null ? Number(l.area) : null })}`, lastModified: l.updatedAt, changeFrequency: 'weekly', priority: 0.7 });
  // Explore: districts + neighborhoods
  if (on('explore')) {
    for (const d of districts) entries.push({ url: `${base}/explore/district/${d.id}`, lastModified: d.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
    for (const n of neighborhoods) entries.push({ url: `${base}/explore/${n.id}`, lastModified: n.updatedAt, changeFrequency: 'weekly', priority: 0.6 });
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
