import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { partnerCanBrowseListings } from '@noc/partner-portal/server';
import { SignOutButton } from '../../account/SignOutButton';
import { StoreShell } from '../../_components/StoreShell';

/** Al Sawarey partner portal — the same shared portal pages, wrapped in Al Sawarey's storefront
 *  chrome with the partner sub-nav on top. The requirePartner guard is the source of truth; the
 *  login gate (NOC_SITE=alsawarey) already ensures only Al-Sawarey-enabled partners get here. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [owner, canBrowse, grantCount] = await Promise.all([
    prisma.owner.findUnique({ where: { id: ownerId }, select: { name: true } }),
    partnerCanBrowseListings(ownerId),
    // Same grant check the Dashboard uses — no grants → no "add listing" entry point.
    prisma.ownerAllowedCategory.count({ where: { ownerId } }),
  ]);

  const nav = [
    { href: '/partner', label: L('لوحتي', 'Dashboard') },
    ...(grantCount > 0 ? [{ href: '/partner/listings/new', label: L('+ إضافة إعلان', '+ Add listing') }] : []),
    ...(canBrowse ? [{ href: '/partner/browse', label: L('تصفّح العروض', 'Browse offers') }] : []),
    { href: '/partner/analytics', label: L('الإحصائيات', 'Analytics') },
    { href: '/partner/account', label: L('حسابي', 'My account') },
  ];

  return (
    <StoreShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 rounded-2xl bg-navy-800 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-lg font-black">
              🔑 {L('بوابة الشركاء', 'Partner portal')}
              <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-gold-300">{owner?.name ?? ''}</span>
            </span>
            <nav className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {nav.map((n) => (
                <a key={n.href} href={n.href} className="rounded-md px-3 py-2 hover:bg-white/10 hover:text-gold-300">{n.label}</a>
              ))}
              <SignOutButton label={L('خروج', 'Sign out')} />
            </nav>
          </div>
        </div>
        {children}
      </div>
    </StoreShell>
  );
}
