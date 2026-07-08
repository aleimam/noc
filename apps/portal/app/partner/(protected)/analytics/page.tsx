import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

/** Partner analytics: 30-day views trend + per-listing performance
 *  (views / contact clicks / wishlist saves / negotiations) + selling totals. */
export default async function PartnerAnalyticsPage() {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const fmt = (n: number) => n.toLocaleString('en-US');

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const [listings, days] = await Promise.all([
    prisma.listing.findMany({
      where: { ownerId },
      orderBy: { views: 'desc' },
      select: {
        id: true, title: true, adNumber: true, status: true, views: true,
        price: true, soldPrice: true,
        _count: { select: { contactRequests: true, wishlistItems: true, negotiations: true } },
      },
    }),
    prisma.listingViewDay.groupBy({
      by: ['date'],
      where: { listing: { ownerId }, date: { gte: since } },
      _sum: { count: true },
    }),
  ]);

  // 30 daily buckets, oldest → newest, zero-filled.
  const byDate = new Map(days.map((d) => [d.date.toISOString().slice(0, 10), d._sum.count ?? 0]));
  const buckets: { day: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ day: key.slice(5), count: byDate.get(key) ?? 0 });
  }
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const trendTotal = buckets.reduce((a, b) => a + b.count, 0);

  const sold = listings.filter((l) => l.status === 'SOLD');
  const soldValue = sold.reduce((a, l) => a + Number(l.soldPrice ?? l.price ?? 0), 0);
  const totals = [
    { label: L('مشاهدات آخر 30 يوماً', 'Views (30 days)'), value: fmt(trendTotal) },
    { label: L('إجمالي المشاهدات', 'Total views'), value: fmt(listings.reduce((a, l) => a + l.views, 0)) },
    { label: L('طلبات تواصل', 'Contact requests'), value: fmt(listings.reduce((a, l) => a + l._count.contactRequests, 0)) },
    { label: L('إعلانات مباعة', 'Sold'), value: fmt(sold.length) },
    { label: L('قيمة المبيعات', 'Sales value'), value: `${fmt(soldValue)} ${L('ج.م', 'EGP')}` },
  ];

  // Inline SVG bar chart — no client JS needed.
  const cw = 900, ch = 160, bw = cw / 30;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-navy-800">📊 {L('الإحصائيات', 'Analytics')}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((s) => (
          <div key={s.label} className="rounded-lg border border-ink-200 bg-white p-4 text-center shadow-sm">
            <div className="font-num text-2xl font-black text-navy-800">{s.value}</div>
            <div className="mt-1 text-xs text-ink-500">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-lg border border-ink-200 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-navy-800">{L('المشاهدات — آخر 30 يوماً', 'Views — last 30 days')}</h2>
        <div className="overflow-x-auto" dir="ltr">
          <svg viewBox={`0 0 ${cw} ${ch + 24}`} className="h-44 w-full min-w-[600px]">
            {buckets.map((b, i) => {
              const h = Math.round((b.count / maxCount) * (ch - 10));
              return (
                <g key={b.day}>
                  <rect x={i * bw + 3} y={ch - h} width={bw - 6} height={h} rx="3" className="fill-gold-500" opacity={b.count ? 0.9 : 0.15} />
                  {i % 5 === 0 && (
                    <text x={i * bw + bw / 2} y={ch + 16} textAnchor="middle" fontSize="10" className="fill-ink-400">{b.day}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-navy-800">{L('أداء الإعلانات', 'Listing performance')}</h2>
        <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-navy-700">
              <tr>
                <th className="p-3 text-start">{L('الإعلان', 'Listing')}</th>
                <th className="p-3 text-center">👁 {L('مشاهدات', 'Views')}</th>
                <th className="p-3 text-center">📞 {L('تواصل', 'Contacts')}</th>
                <th className="p-3 text-center">❤️ {L('مفضلة', 'Saves')}</th>
                <th className="p-3 text-center">🤝 {L('مفاوضات', 'Offers')}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-ink-100">
                  <td className="p-3">
                    <span className="font-semibold text-navy-800">{l.title}</span>
                    {l.adNumber && <span className="ms-2 font-num text-xs text-ink-400" dir="ltr">#{l.adNumber}</span>}
                  </td>
                  <td className="p-3 text-center font-num font-bold">{fmt(l.views)}</td>
                  <td className="p-3 text-center font-num">{fmt(l._count.contactRequests)}</td>
                  <td className="p-3 text-center font-num">{fmt(l._count.wishlistItems)}</td>
                  <td className="p-3 text-center font-num">{fmt(l._count.negotiations)}</td>
                </tr>
              ))}
              {listings.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-ink-400">{L('لا توجد إعلانات بعد', 'No listings yet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
