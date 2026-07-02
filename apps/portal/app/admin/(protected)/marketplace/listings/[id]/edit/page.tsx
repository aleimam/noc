import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog, buildVals, loadListingAttachments } from '@/app/account/listings/catalog';

export default async function StaffEditListing({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'UPDATE');
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, include: { values: true } });
  if (!listing) notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas } = await loadCatalog();
  const [owners, attachData] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    loadListingAttachments(id),
  ]);
  const { photos, attachs } = attachData;
  const vals = buildVals(listing.values, new Map(attributes.map((a) => [a.id, a.type])));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {listing.title}</h1>
        <a href="/admin/marketplace/listings" className="text-sm text-accent">← {t('moderation')}</a>
      </div>
      <ListingForm
        staffMode
        owners={owners.map((o) => ({ id: o.id, name: o.name, type: o.type }))}
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        initial={{
          id: listing.id,
          typeOptionId: listing.typeOptionId ?? '',
          purposeOptionId: listing.purposeOptionId ?? '',
          conditionOptionId: listing.conditionOptionId ?? '',
          title: listing.title,
          description: listing.description ?? '',
          price: listing.price != null ? String(listing.price) : '',
          priceNote: listing.priceNote ?? '',
          contactPhone: listing.contactPhone,
          contactWhatsapp: listing.contactWhatsapp,
          ownerId: listing.ownerId ?? '',
          ownerName: listing.ownerName ?? '',
          ownerType: listing.ownerType ?? 'PERSONAL',
          showOnBrokerage: listing.showOnBrokerage,
          vals,
          photos,
          attachs,
        }}
      />
    </div>
  );
}
