import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function WishlistsAdmin() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  await requirePermission('listings', 'VIEW');

  const [lists, top] = await Promise.all([
    prisma.wishlistList.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { user: { select: { phone: true, name: true } }, _count: { select: { items: true } } },
    }),
    // Exclude trashed listings so they can't consume a top-wishlist rank.
    prisma.wishlistItem.groupBy({
      by: ['listingId'],
      where: { listing: { deletedAt: null } },
      _count: { _all: true },
      orderBy: { _count: { listingId: 'desc' } },
      take: 10,
    }),
  ]);

  const titles = new Map(
    (await prisma.listing.findMany({ where: { id: { in: top.map((t) => t.listingId) }, deletedAt: null }, select: { id: true, title: true, adNumber: true } })).map((l) => [l.id, l]),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('قوائم المفضلة', 'Wishlists')}</h1>
        <a href="/admin/marketplace" className="text-sm text-accent">{L('← السوق', '← Marketplace')}</a>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">{L('الأكثر إضافةً للمفضلة', 'Most wishlisted')}</h2>
        {top.length === 0 ? (
          <p className="text-sm opacity-60">{L('لا توجد بيانات بعد', 'No data yet')}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-graphite/15">
            <table className="w-full text-sm">
              <tbody>
                {top.map((t) => (
                  <tr key={t.listingId} className="border-t border-graphite/10 first:border-t-0">
                    <td className="p-2">{titles.get(t.listingId)?.title ?? t.listingId}</td>
                    <td className="p-2 font-num" dir="ltr">{titles.get(t.listingId)?.adNumber ? `#${titles.get(t.listingId)?.adNumber}` : ''}</td>
                    <td className="p-2 text-end font-bold">{t._count._all}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{L('كل القوائم', 'All lists')} ({lists.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead className="opacity-60">
              <tr>
                <th className="p-2 text-start">{L('القائمة', 'List')}</th>
                <th className="p-2 text-start">{L('المالك', 'Owner')}</th>
                <th className="p-2 text-start">{L('عدد الأراضي', 'Land count')}</th>
              </tr>
            </thead>
            <tbody>
              {lists.length === 0 && <tr><td colSpan={3} className="p-4 text-center opacity-60">{L('لا توجد قوائم', 'No lists')}</td></tr>}
              {lists.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2 font-medium">{l.name}</td>
                  <td className="p-2" dir="ltr">{l.user ? l.user.phone ?? l.user.name : L('زائر', 'Guest')}</td>
                  <td className="p-2">{l._count.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
