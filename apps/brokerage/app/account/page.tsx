import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { StoreShell } from '../_components/StoreShell';
import { StoreLandCard } from '../_components/StoreLandCard';
import { listLands } from '../../lib/listings';
import { SignOutButton } from './SignOutButton';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, [string, string]> = {
  NEW: ['جديد', 'New'],
  CONTACTED: ['تم التواصل', 'Contacted'],
  NEGOTIATING: ['قيد التفاوض', 'Negotiating'],
  SOLD: ['تم البيع', 'Sold'],
  LOST: ['مغلق', 'Closed'],
};

export default async function AccountPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const locale = (await getLocale()) as 'ar' | 'en';
  if (!userId) redirect('/account/login?next=/account');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [dbUser, wish, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true, name: true } }),
    prisma.wishlist.findMany({ where: { userId }, select: { listingId: true } }),
    prisma.contactRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { listing: { select: { id: true, title: true, adNumber: true } } },
    }),
  ]);

  const wishIds = wish.map((w) => w.listingId);
  const { cards } = wishIds.length ? await listLands({ where: { id: { in: wishIds } }, take: 100 }) : { cards: [] };

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-navy-800">{L('حسابي', 'My account')}</h1>
            <p className="text-sm text-ink-500" dir="ltr">{dbUser?.phone ?? ''}</p>
          </div>
          <SignOutButton label={L('تسجيل الخروج', 'Sign out')} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-navy-800">{L('المفضلة', 'Wishlist')}</h2>
          {cards.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-ink-500 shadow-sm">
              {L('لم تقم بحفظ أي أرض بعد.', 'You haven’t saved any lands yet.')} <Link href="/listings" className="font-bold text-gold-700">{L('تصفّح الأراضي', 'Browse lands')}</Link>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((land) => <StoreLandCard key={land.id} land={land} locale={locale} wishlisted />)}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-navy-800">{L('طلباتي', 'My requests')}</h2>
          {requests.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-ink-500 shadow-sm">{L('لا توجد طلبات بعد.', 'No requests yet.')}</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-navy-700">
                  <tr>
                    <th className="p-3 text-start">{L('الأرض', 'Land')}</th>
                    <th className="p-3 text-start">{L('الحالة', 'Status')}</th>
                    <th className="p-3 text-start">{L('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-ink-100">
                      <td className="p-3">
                        {r.listing ? (
                          <Link href={`/listings/${r.listing.id}`} className="text-navy-700 hover:underline">
                            {r.listing.adNumber ? <span className="font-num" dir="ltr">#{r.listing.adNumber} </span> : ''}{r.listing.title}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="p-3">{L(...(STATUS_LABEL[r.status] ?? [r.status, r.status]))}</td>
                      <td className="p-3" dir="ltr">{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </StoreShell>
  );
}
