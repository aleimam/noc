import { getModuleVisibility } from '../../lib/modules';

export const dynamic = 'force-dynamic';

// llms.txt — an AI-crawler-friendly overview of the site + key links (emerging standard).
export async function GET() {
  const base = (process.env.PORTAL_URL || 'https://newobour.com').replace(/\/$/, '');
  const vis = await getModuleVisibility();
  const services: [keyof typeof vis, string, string][] = [
    ['rationing', '/rationing', 'كشوف التقنين / Rationing (legalization) lists — search the registers by applicant name'],
    ['explore', '/explore', 'استكشاف الأحياء / Explore neighborhoods — districts, neighborhoods, amenities & maps'],
    ['guide', '/guide', 'دليل البناء / Building guide — licensing steps & building conditions'],
    ['calculator', '/calculator', 'الحاسبات / Calculators — area & reconciliation-cost calculators'],
    ['market', '/market', 'السوق / Marketplace — land plots & units for sale'],
    ['news', '/news', 'الأخبار / News — utilities, roads and handover updates'],
    ['priceIndex', '/price-index', 'مؤشر الأسعار / Price index — average price per m² by district'],
  ];
  const lines = [
    '# العبور الجديدة (New Obour) — newobour.com',
    '',
    '> Free, official-style services portal for New Obour City, Egypt. Fully bilingual (Arabic default, English available).',
    '',
    '## Services',
    ...services.filter(([k]) => vis[k] !== false).map(([, path, desc]) => `- [${desc}](${base}${path})`),
    '',
    '## More',
    `- Sitemap: ${base}/sitemap.xml`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
