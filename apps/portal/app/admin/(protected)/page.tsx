import { getLocale, getTranslations } from 'next-intl/server';
import { auth, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await auth();
  const user = session!.user;
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const can = (section: string) => hasPermission(user.perms, section, 'VIEW');

  const [
    sheets, ratFollows, searches, scans, cities,
    districts, neighborhoods, lands, landFollows,
    listingsTotal, listingsPending, listingsPublished, listingsSold, onBrokerage,
    offersOpen, owners, wishlists, leads,
    customers, customersVerified, staff,
    recentPending, recentOffers,
  ] = await Promise.all([
    prisma.rationingSheet.count(),
    prisma.rationingFollow.count(),
    prisma.sheetSearchLog.count(),
    prisma.rationingScan.count(),
    prisma.rationingCity.count(),
    prisma.district.count(),
    prisma.neighborhood.count(),
    prisma.land.count(),
    prisma.landFollow.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PENDING' } }),
    prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    prisma.listing.count({ where: { status: 'SOLD' } }),
    prisma.listing.count({ where: { showOnBrokerage: true } }),
    prisma.landOffer.count({ where: { status: { in: ['NEW', 'REVIEWING'] } } }),
    prisma.owner.count(),
    prisma.wishlistList.count(),
    prisma.contactRequest.count(),
    prisma.user.count({ where: { type: 'CUSTOMER' } }),
    prisma.user.count({ where: { type: 'CUSTOMER', phoneVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { type: 'STAFF' } }),
    prisma.listing.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true } }),
    prisma.landOffer.findMany({ where: { status: { in: ['NEW', 'REVIEWING'] } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, ownerName: true, createdAt: true } }),
  ]);

  type Kpi = { label: string; value: number; href?: string; alert?: boolean };
  const Section = ({ title, kpis }: { title: string; kpis: Kpi[] }) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const inner = (
            <>
              <div className={`text-3xl font-black ${k.alert ? 'text-amber-600' : 'text-primary'}`}>{k.value.toLocaleString('en-US')}</div>
              <div className="mt-1 text-sm opacity-70">{k.label}</div>
            </>
          );
          return k.href ? (
            <a key={k.label} href={k.href} className="rounded-xl border border-graphite/15 p-4 transition-colors hover:border-accent">{inner}</a>
          ) : (
            <div key={k.label} className="rounded-xl border border-graphite/15 p-4">{inner}</div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-primary">{t('dashboard')}</h1>

      {can('sheets') && (
        <Section
          title={L('كشوف التقنين', 'Rationing')}
          kpis={[
            { label: L('سجلات', 'Records'), value: sheets, href: '/admin/rationing' },
            { label: L('صور الكشوف', 'Scans'), value: scans, href: '/admin/rationing/scans' },
            { label: L('متابعات', 'Follows'), value: ratFollows },
            { label: L('عمليات البحث', 'Searches'), value: searches, href: '/admin/rationing/searches' },
            { label: L('المدن', 'Cities'), value: cities },
          ]}
        />
      )}

      {can('lands') && (
        <Section
          title={L('الأراضي والمناطق', 'Lands & areas')}
          kpis={[
            { label: L('الأحياء', 'Districts'), value: districts, href: '/admin/lands/districts' },
            { label: L('المجاورات', 'Neighborhoods'), value: neighborhoods, href: '/admin/lands/neighborhoods' },
            { label: L('الأراضي', 'Lands'), value: lands, href: '/admin/lands/lands' },
            { label: L('متابعات المناطق', 'Area follows'), value: landFollows, href: '/admin/lands/follows' },
          ]}
        />
      )}

      {can('marketplace') && (
        <Section
          title={L('السوق والصواري', 'Marketplace & ALSWARY')}
          kpis={[
            { label: L('إجمالي العروض', 'Total listings'), value: listingsTotal, href: '/admin/marketplace/listings' },
            { label: L('بانتظار المراجعة', 'Pending review'), value: listingsPending, href: '/admin/marketplace/listings', alert: listingsPending > 0 },
            { label: L('منشورة', 'Published'), value: listingsPublished },
            { label: L('على الصواري', 'On ALSWARY'), value: onBrokerage },
            { label: L('مباعة', 'Sold'), value: listingsSold },
            { label: L('عروض بيع واردة', 'Incoming offers'), value: offersOpen, href: '/admin/marketplace/offers', alert: offersOpen > 0 },
            { label: L('الملاك', 'Owners'), value: owners, href: '/admin/marketplace/owners' },
            { label: L('طلبات التواصل', 'Leads'), value: leads },
            { label: L('قوائم المفضلة', 'Wishlists'), value: wishlists, href: '/admin/marketplace/wishlists' },
          ]}
        />
      )}

      {(can('customers') || can('staff')) && (
        <Section
          title={L('المستخدمون', 'People')}
          kpis={[
            ...(can('customers')
              ? ([
                  { label: L('العملاء', 'Customers'), value: customers, href: '/admin/settings/customers' },
                  { label: L('مؤكَّدون', 'Verified'), value: customersVerified },
                  { label: L('غير مؤكَّدين', 'Unverified'), value: customers - customersVerified, alert: customers - customersVerified > 0 },
                ] as Kpi[])
              : []),
            ...(can('staff') ? ([{ label: L('فريق العمل', 'Staff'), value: staff, href: '/admin/settings/users' }] as Kpi[]) : []),
          ]}
        />
      )}

      {can('marketplace') && (recentPending.length > 0 || recentOffers.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-graphite/15 p-4">
            <h3 className="font-semibold text-primary">{L('عروض بانتظار المراجعة', 'Listings awaiting review')}</h3>
            {recentPending.length === 0 ? (
              <p className="text-sm opacity-60">{L('لا يوجد', 'None')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {recentPending.map((l) => (
                  <li key={l.id}><a href={`/admin/marketplace/listings/${l.id}/edit`} className="text-accent hover:underline">{l.title}</a></li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-graphite/15 p-4">
            <h3 className="font-semibold text-primary">{L('عروض بيع واردة', 'Incoming sell offers')}</h3>
            {recentOffers.length === 0 ? (
              <p className="text-sm opacity-60">{L('لا يوجد', 'None')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {recentOffers.map((o) => (
                  <li key={o.id}><a href={`/admin/marketplace/offers/${o.id}`} className="text-accent hover:underline">{o.ownerName}</a> <span className="opacity-50">· {o.createdAt.toISOString().slice(0, 10)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
