import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/app/listings/ListingForm';
import { loadCatalog, buildVals } from '@/app/app/listings/catalog';

export default async function StaffEditListing({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('marketplace', 'UPDATE');
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, include: { values: true } });
  if (!listing) notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { propertyTypes, sections, attributes } = await loadCatalog();
  const [owners, photos] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: id }, select: { id: true, path: true, originalName: true } }),
  ]);
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
        propertyTypes={propertyTypes}
        sections={sections}
        attributes={attributes}
        locale={locale}
        initial={{
          id: listing.id,
          propertyTypeId: listing.propertyTypeId,
          title: listing.title,
          description: listing.description ?? '',
          price: listing.price != null ? String(listing.price) : '',
          priceNote: listing.priceNote ?? '',
          contactPhone: listing.contactPhone,
          contactWhatsapp: listing.contactWhatsapp,
          ownerId: listing.ownerId ?? '',
          ownerName: listing.ownerName ?? '',
          ownerType: listing.ownerType ?? 'OWNER',
          showOnBrokerage: listing.showOnBrokerage,
          vals,
          photos: photos.map((p) => ({ id: p.id, path: p.path, originalName: p.originalName })),
        }}
      />
    </div>
  );
}
