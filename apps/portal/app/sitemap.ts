import type { MetadataRoute } from 'next';
import { prisma } from '@noc/db';
import { getModuleVisibility } from '../lib/modules';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const [vis, news, pages] = await Promise.all([
    getModuleVisibility(),
    prisma.news.findMany({ where: { publishedAt: { not: null } }, select: { id: true, updatedAt: true }, take: 500 }),
    prisma.page.findMany({ where: { brand: 'newobour', published: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [{ url: base, changeFrequency: 'daily', priority: 1 }];
  // module landing pages (only the enabled ones)
  const modulePaths: [string, string][] = [
    ['market', '/market'], ['explore', '/explore'], ['rationing', '/rationing'], ['news', '/news'], ['guide', '/guide'], ['priceIndex', '/price-index'],
  ];
  for (const [key, path] of modulePaths) if (vis[key as keyof typeof vis] !== false) entries.push({ url: `${base}${path}`, changeFrequency: 'weekly', priority: 0.8 });
  if (vis.news !== false) for (const n of news) entries.push({ url: `${base}/news/${n.id}`, lastModified: n.updatedAt, priority: 0.6 });
  for (const p of pages) entries.push({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.4 });
  return entries;
}
