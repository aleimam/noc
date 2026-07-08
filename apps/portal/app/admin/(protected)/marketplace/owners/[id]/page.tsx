import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { currency } from '@noc/i18n';
import { PartnerPortalPanel } from './PartnerPortalPanel';

export const dynamic = 'force-dynamic';
const pad = (n: number) => String(n).padStart(2, '0');

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'VIEW');
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('mp');

  const owner = await prisma.owner.findUnique({
    where: { id },
    include: {
      codes: { orderBy: { code: 'asc' }, select: { code: true } },
      listings: {
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true, price: true, adNumber: true, showOnBrokerage: true },
      },
      portalUser: { select: { username: true, email: true, phone: true, isActive: true, passwordHash: true } },
      allowedCategories: { select: { optionId: true } },
      _count: { select: { lands: true } },
    },
  });
  if (!owner) notFound();
  const typeOptions = await prisma.classifierOption.findMany({
    where: { isActive: true, classifier: { key: 'type' } },
    orderBy: { order: 'asc' },
    select: { id: true, nameAr: true, nameEn: true },
  });

  const phones = [
    owner.phone1 && `${owner.phone1}${owner.phone1Whatsapp ? ' (WA)' : ''}`,
    owner.phone2 && `${owner.phone2}${owner.phone2Whatsapp ? ' (WA)' : ''}`,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{owner.name}</h1>
        <a href="/admin/marketplace/owners" className="text-sm text-accent">← {t('backToOwners')}</a>
      </div>

      {/* Owner info */}
      <div className="space-y-2 rounded-lg border border-graphite/15 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{t(`type${owner.type}`)}</span>
          {owner.codes.length > 0 && (
            <span className="rounded bg-gold/20 px-2 py-0.5 font-num text-xs" dir="ltr">{owner.codes.map((c) => pad(c.code)).join(' · ')}</span>
          )}
        </div>
        {phones.length > 0 && <div dir="ltr" className="opacity-80">{phones.join('  ·  ')}</div>}
        {owner.details && <p className="opacity-70">{owner.details}</p>}
      </div>

      {/* Partner-portal access: login account + allowed posting categories (not for US). */}
      {owner.type !== 'US' && (
        <PartnerPortalPanel
          ownerId={owner.id}
          account={{
            exists: !!owner.portalUser,
            username: owner.portalUser?.username ?? '',
            email: owner.portalUser?.email ?? '',
            phone: owner.portalUser?.phone ?? owner.phone1 ?? '',
            isActive: owner.portalUser?.isActive ?? true,
            hasPassword: !!owner.portalUser?.passwordHash,
          }}
          typeOptions={typeOptions}
          granted={owner.allowedCategories.map((c) => c.optionId)}
          locale={locale}
        />
      )}

      {/* Listings */}
      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('ownerListings')} ({owner.listings.length})</h2>
        {owner.listings.length === 0 ? (
          <p className="text-sm opacity-60">{t('ownerNothing')}</p>
        ) : (
          <ul className="divide-y divide-graphite/10 rounded-lg border border-graphite/15">
            {owner.listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <a href={`/admin/marketplace/listings/${l.id}/edit`} className="font-medium text-accent hover:underline">{l.title}</a>
                <span className="flex items-center gap-2 whitespace-nowrap opacity-70">
                  {l.adNumber && <span className="font-num text-xs" dir="ltr">#{l.adNumber}</span>}
                  {l.price != null && <span className="font-num">{String(l.price)} {currency(locale)}</span>}
                  <span className="rounded bg-graphite/10 px-2 py-0.5 text-xs">{t(`status${l.status}`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lands (geo) */}
      <section className="space-y-2">
        <h2 className="font-semibold text-primary">{t('ownerLands')} ({owner._count.lands})</h2>
      </section>
    </div>
  );
}
