import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '../../ListingForm';
import { loadCatalog, buildVals } from '../../catalog';

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/app/login');
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id }, include: { values: true } });
  if (!listing) notFound();
  if (listing.sellerId !== session.user.id && session.user.type !== 'STAFF') notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { propertyTypes, sections, attributes } = await loadCatalog();
  const photos = await prisma.attachment.findMany({
    where: { ownerType: 'Listing', ownerId: id },
    select: { id: true, path: true, originalName: true },
  });

  const attrType = new Map(attributes.map((a) => [a.id, a.type]));
  const vals = buildVals(listing.values, attrType);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {listing.title}</h1>
        <a href="/app/listings" className="text-sm text-accent">← {t('myOffers')}</a>
      </div>
      <ListingForm
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
    </main>
  );
}
