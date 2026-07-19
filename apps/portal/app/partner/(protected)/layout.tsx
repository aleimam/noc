import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { partnerCanBrowseListings } from '@noc/partner-portal/server';
import { SignOutButton } from '../../_components/SignOutButton';
import { SiteShell } from '../../_components/SiteShell';

/** Partner portal — wrapped in the FULL public site chrome so partners browse every service
 *  like a normal visitor, with a partner sub-nav (their extra powers) on top. The middleware
 *  gates /partner too; this server guard is the source of truth. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const owner = await prisma.owner.findUnique({ where: { id: ownerId }, select: { name: true } });
  const canBrowse = await partnerCanBrowseListings(ownerId);

  // «إعلاناتي» = the partner's own listings (the dashboard: stats + editable listings table;
  // matches the Dashboard heading). «عروض الصواري» = view-only browse of every Al Sawarey offer
  // (owner request 2026-07-18). Kept identical to the brokerage partner nav — change both together.
  const nav = [
    { href: '/partner', label: L('إعلاناتي', 'My listings') },
    { href: '/partner/listings/new', label: L('+ إضافة إعلان', '+ Add listing') },
    ...(canBrowse ? [{ href: '/partner/browse', label: L('عروض الصواري', 'Al Sawarey offers') }] : []),
    { href: '/partner/analytics', label: L('الإحصائيات', 'Analytics') },
    { href: '/partner/account', label: L('حسابي', 'My account') },
  ];

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 rounded-2xl bg-navy-800 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-lg font-black">
              🔑 {L('بوابة الشركاء', 'Partner portal')}
              <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-gold-300">{owner?.name ?? ''}</span>
            </span>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
              {nav.map((n) => (
                <a key={n.href} href={n.href} className="hover:text-gold-300">{n.label}</a>
              ))}
              <SignOutButton />
            </nav>
          </div>
        </div>
        {children}
      </div>
    </SiteShell>
  );
}
