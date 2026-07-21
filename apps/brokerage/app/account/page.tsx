import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { StoreShell } from '../_components/StoreShell';
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

  const [dbUser, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true, name: true } }),
    prisma.contactRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { listing: { select: { id: true, title: true, adNumber: true } } },
    }),
  ]);

  return (
    <StoreShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-navy-800 dark:text-soft">{L('حسابي', 'My account')}</h1>
            <p className="text-sm text-ink-500" dir="ltr">{dbUser?.phone ?? ''}</p>
          </div>
          <SignOutButton label={L('تسجيل الخروج', 'Sign out')} />
        </div>

        <section className="mt-8">
          <Link href="/wishlist" className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-5 py-3 font-bold text-navy-800 hover:border-gold dark:bg-navy-800 dark:text-soft">
            ♥ {L('قوائم المفضلة', 'My wishlists')}
          </Link>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-navy-800 dark:text-soft">{L('طلباتي', 'My requests')}</h2>
          {requests.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-ink-500 shadow-sm">{L('لا توجد طلبات بعد.', 'No requests yet.')}</p>
          ) : (
            // overflow-x-auto, not overflow-hidden: at 320–375px the columns were clipped with
            // no way to reach the status/date, and the page itself must stay overflow-safe.
            <div className="overflow-x-auto rounded-2xl bg-white text-navy-800 shadow-sm">
              <table className="w-full min-w-[32rem] text-sm">
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
                      <td className="p-3" dir="ltr">{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(r.createdAt)}</td>
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
