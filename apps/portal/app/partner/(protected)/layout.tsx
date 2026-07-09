import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { partnerCanBrowseListings } from '../../../lib/partner';
import { SignOutButton } from '../../_components/SignOutButton';

/** Partner-portal shell: navy top bar with the owner name + simple nav. The
 *  middleware gates /partner too; this server guard is the source of truth. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const owner = await prisma.owner.findUnique({ where: { id: ownerId }, select: { name: true } });
  const canBrowse = await partnerCanBrowseListings(ownerId);

  const nav = [
    { href: '/partner', label: L('لوحتي', 'Dashboard') },
    ...(canBrowse ? [{ href: '/partner/browse', label: L('تصفّح العروض', 'Browse offers') }] : []),
    { href: '/partner/analytics', label: L('الإحصائيات', 'Analytics') },
    { href: '/partner/account', label: L('حسابي', 'My account') },
  ];

  return (
    <div className="min-h-screen bg-soft">
      <header className="bg-navy-800 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black">🔑 {L('بوابة الشركاء', 'Partner portal')}</span>
            <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-gold-300">{owner?.name ?? ''}</span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-gold-300">{n.label}</a>
            ))}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
