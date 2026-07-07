export const dynamic = 'force-dynamic';

// llms.txt — AI-crawler-friendly overview of the storefront + key links.
export async function GET() {
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  const lines = [
    '# الصواري للاستثمار العقاري (Al Sawarey Real-estate Investment) — alsawarey.com',
    '',
    '> Selected land plots for sale in New Obour City, Egypt and nearby areas. Fully bilingual (Arabic default, English available).',
    '',
    '## Pages',
    `- [الأراضي المتاحة / Available lands](${base}/listings) — browse plots by area, corner, main road, services and price`,
    `- [اعرض أرضك للبيع / Sell your land](${base}/sell) — owners submit a plot for us to market`,
    '',
    '## More',
    `- Sitemap: ${base}/sitemap.xml`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
