// RSS 2.0 feed of the latest ~20 published items: News posts + geo Updates (city/district/
// neighborhood). Linked from the portal layout <head>. Content-Type application/rss+xml.
import { prisma } from '@noc/db';
import { PORTAL_URL } from '../../lib/seo';
import { getModuleVisibility } from '../../lib/modules';
import { cityHref, districtHref, neighborhoodHref } from '../../lib/geoHref';

export const dynamic = 'force-dynamic';

const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const snippet = (s: string, n = 300) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);

export async function GET() {
  const base = PORTAL_URL;
  const vis = await getModuleVisibility();

  const [news, updates] = await Promise.all([
    vis.news !== false
      ? prisma.news.findMany({
          where: { publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 20,
          select: { id: true, titleAr: true, bodyAr: true, publishedAt: true },
        })
      : Promise.resolve([]),
    vis.explore !== false
      ? prisma.geoUpdate.findMany({
          where: { OR: [{ neighborhoodId: { not: null } }, { districtId: { not: null } }, { cityId: { not: null } }] },
          orderBy: { happenedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            body: true,
            happenedAt: true,
            city: { select: { id: true, key: true } },
            district: { select: { id: true, key: true } },
            neighborhood: { select: { id: true, nameAr: true, district: { select: { nameAr: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  type Item = { title: string; link: string; date: Date; desc: string };
  const items: Item[] = [];

  for (const n of news) {
    items.push({ title: n.titleAr, link: `${base}/news/${n.id}`, date: n.publishedAt!, desc: snippet(stripHtml(n.bodyAr)) });
  }
  for (const u of updates) {
    let path: string | null = null;
    if (u.neighborhood) path = neighborhoodHref({ id: u.neighborhood.id, nameAr: u.neighborhood.nameAr, district: u.neighborhood.district });
    else if (u.district) path = districtHref(u.district);
    else if (u.city) path = cityHref(u.city);
    if (!path) continue;
    items.push({ title: u.title || 'تحديث', link: `${base}${path}`, date: u.happenedAt, desc: snippet(stripHtml(u.body)) });
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  const top = items.slice(0, 20);
  const now = new Date().toUTCString();

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n<channel>\n` +
    `<title>العبور الجديدة — أحدث الأخبار والتحديثات</title>\n` +
    `<link>${base}</link>\n` +
    `<description>أحدث أخبار وتحديثات مدينة العبور الجديدة</description>\n` +
    `<language>ar</language>\n` +
    `<lastBuildDate>${now}</lastBuildDate>\n` +
    top
      .map(
        (it) =>
          `<item>` +
          `<title>${xmlEsc(it.title)}</title>` +
          `<link>${xmlEsc(it.link)}</link>` +
          `<guid isPermaLink="true">${xmlEsc(it.link)}</guid>` +
          `<pubDate>${it.date.toUTCString()}</pubDate>` +
          `<description>${xmlEsc(it.desc)}</description>` +
          `</item>`,
      )
      .join('\n') +
    `\n</channel>\n</rss>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
