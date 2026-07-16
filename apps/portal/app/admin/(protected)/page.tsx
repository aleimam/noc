import { getLocale, getTranslations } from 'next-intl/server';
import { auth, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { RecentFeaturesGrid } from '@noc/ui';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await auth();
  const user = session!.user;
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const can = (section: string) => hasPermission(user.perms, section, 'VIEW');

  // Every KPI is gated by the viewer's section permission — both the query (skipped
  // entirely when not visible) and the tile render below.
  const canSheets = can('sheets');
  const canLands = can('lands');
  const canListings = can('listings');
  const canOwners = can('owners');
  const canCustomers = can('customers');
  const canStaff = can('staff');
  const count = (allowed: boolean, fn: () => Promise<number>) => (allowed ? fn() : Promise.resolve(0));

  const [
    sheets, ratFollows, searches, scans, cities,
    districts, neighborhoods, landFollows,
    listingsTotal, listingsPending, listingsPublished, listingsSold, onBrokerage,
    offersOpen, owners, wishlists, leads,
    customers, customersVerified, staff,
    recentPending, recentOffers,
  ] = await Promise.all([
    count(canSheets, () => prisma.rationingSheet.count()),
    count(canSheets, () => prisma.rationingFollow.count()),
    count(canSheets, () => prisma.sheetSearchLog.count()),
    count(canSheets, () => prisma.rationingScan.count()),
    count(canSheets, () => prisma.rationingCity.count()),
    count(canLands, () => prisma.district.count()),
    count(canLands, () => prisma.neighborhood.count()),
    count(canLands, () => prisma.landFollow.count()),
    count(canListings, () => prisma.listing.count({ where: { deletedAt: null } })),
    count(canListings, () => prisma.listing.count({ where: { status: 'PENDING', deletedAt: null } })),
    count(canListings, () => prisma.listing.count({ where: { status: 'PUBLISHED', deletedAt: null } })),
    count(canListings, () => prisma.listing.count({ where: { status: 'SOLD', deletedAt: null } })),
    count(canListings, () => prisma.listing.count({ where: { showOnBrokerage: true } })),
    count(canListings, () => prisma.landOffer.count({ where: { status: { in: ['NEW', 'REVIEWING'] } } })),
    count(canOwners, () => prisma.owner.count()),
    count(canListings, () => prisma.wishlistList.count()),
    count(canListings, () => prisma.contactRequest.count()),
    count(canCustomers, () => prisma.user.count({ where: { type: 'CUSTOMER' } })),
    count(canCustomers, () => prisma.user.count({ where: { type: 'CUSTOMER', phoneVerifiedAt: { not: null } } })),
    count(canStaff, () => prisma.user.count({ where: { type: 'STAFF' } })),
    canListings
      ? prisma.listing.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true } })
      : Promise.resolve([]),
    canListings
      ? prisma.landOffer.findMany({ where: { status: { in: ['NEW', 'REVIEWING'] } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, ownerName: true, createdAt: true } })
      : Promise.resolve([]),
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

      {/* Per-user one-tap shortcuts to the features this admin actually uses (device-local). */}
      <RecentFeaturesGrid
        userKey={user.id}
        title={L('استخدمتها مؤخراً', 'Recently used')}
        emptyHint={L('اختصاراتك ستظهر هنا تلقائياً مع استخدامك لأقسام اللوحة.', 'Your shortcuts will appear here automatically as you use the admin sections.')}
      />

      {canSheets && (
        <Section
          title={L('كشوف التقنين', 'Rationing')}
          kpis={[
            { label: L('سجلات', 'Records'), value: sheets, href: '/admin/rationing' },
            { label: L('صور الكشوف', 'Scans'), value: scans, href: '/admin/rationing/scans' },
            { label: L('متابعات', 'Follows'), value: ratFollows },
            { label: L('عمليات البحث', 'Searches'), value: searches, href: '/admin/rationing/searches' },
            { label: L('الجمعيات', 'Cities'), value: cities },
          ]}
        />
      )}

      {canLands && (
        <Section
          title={L('الأراضي والمناطق', 'Lands & areas')}
          kpis={[
            { label: L('الأحياء', 'Districts'), value: districts, href: '/admin/lands/districts' },
            { label: L('المجاورات', 'Neighborhoods'), value: neighborhoods, href: '/admin/lands/neighborhoods' },
            { label: L('متابعات المناطق', 'Area follows'), value: landFollows, href: '/admin/lands/follows' },
          ]}
        />
      )}

      {(canListings || canOwners) && (
        <Section
          title={L('السوق والصواري', 'Marketplace & Al Sawarey')}
          kpis={[
            ...(canListings
              ? ([
                  { label: L('إجمالي العروض', 'Total listings'), value: listingsTotal, href: '/admin/marketplace/listings' },
                  { label: L('بانتظار المراجعة', 'Pending review'), value: listingsPending, href: '/admin/marketplace/listings', alert: listingsPending > 0 },
                  { label: L('منشورة', 'Published'), value: listingsPublished },
                  { label: L('على الصواري', 'On Al Sawarey'), value: onBrokerage },
                  { label: L('مباعة', 'Sold'), value: listingsSold },
                  { label: L('عروض بيع واردة', 'Incoming offers'), value: offersOpen, href: '/admin/marketplace/offers', alert: offersOpen > 0 },
                ] as Kpi[])
              : []),
            ...(canOwners ? ([{ label: L('الملاك', 'Owners'), value: owners, href: '/admin/marketplace/owners' }] as Kpi[]) : []),
            ...(canListings
              ? ([
                  { label: L('طلبات التواصل', 'Leads'), value: leads },
                  { label: L('قوائم المفضلة', 'Wishlists'), value: wishlists, href: '/admin/marketplace/wishlists' },
                ] as Kpi[])
              : []),
          ]}
        />
      )}

      {(canCustomers || canStaff) && (
        <Section
          title={L('المستخدمون', 'People')}
          kpis={[
            ...(canCustomers
              ? ([
                  { label: L('العملاء', 'Customers'), value: customers, href: '/admin/settings/customers' },
                  { label: L('مؤكَّدون', 'Verified'), value: customersVerified },
                  { label: L('غير مؤكَّدين', 'Unverified'), value: customers - customersVerified, alert: customers - customersVerified > 0 },
                ] as Kpi[])
              : []),
            ...(canStaff ? ([{ label: L('فريق العمل', 'Staff'), value: staff, href: '/admin/settings/users' }] as Kpi[]) : []),
          ]}
        />
      )}

      {canListings && (recentPending.length > 0 || recentOffers.length > 0) && (
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
