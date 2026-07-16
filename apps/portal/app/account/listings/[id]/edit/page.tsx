import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '../../ListingForm';
import { loadCatalog, buildVals, loadListingAttachments } from '../../catalog';
import { getCalculatorConfig } from '../../../../../lib/calculator/config';

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/account/login');
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id }, include: { values: true, buildingConditions: { select: { conditionId: true } } } });
  if (!listing) notFound();
  if (listing.sellerId !== session.user.id && session.user.type !== 'STAFF') notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas, buildingConditions } = await loadCatalog();
  const calcConfig = await getCalculatorConfig();
  const { photos, attachs } = await loadListingAttachments(id);
  const vals = buildVals(listing.values, new Map(attributes.map((a) => [a.id, a.type])));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {listing.title}</h1>
        <a href="/account/listings" className="text-sm text-accent">← {t('myOffers')}</a>
      </div>
      <ListingForm
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        buildingConditions={buildingConditions}
        calcConfig={calcConfig}
        initial={{
          id: listing.id,
          typeOptionId: listing.typeOptionId ?? '',
          purposeOptionId: listing.purposeOptionId ?? '',
          conditionOptionId: listing.conditionOptionId ?? '',
          title: listing.title,
          description: listing.description ?? '',
          area: listing.area != null ? String(listing.area) : '',
          price: listing.price != null ? String(listing.price) : '',
          priceUnit: listing.priceUnit,
          priceNegotiable: listing.priceNegotiable,
          priceNote: listing.priceNote ?? '',
          lowestPrice: listing.lowestPrice != null ? String(listing.lowestPrice) : '',
          status: listing.status,
          isPartnership: listing.isPartnership,
          partnershipType: listing.partnershipType ?? '',
          partnershipNote: listing.partnershipNote ?? '',
          contactPhone: listing.contactPhone,
          contactWhatsapp: listing.contactWhatsapp,
          ownerId: listing.ownerId ?? '',
          ownerName: listing.ownerName ?? '',
          ownerType: listing.ownerType ?? 'PERSONAL',
          showOnBrokerage: listing.showOnBrokerage,
          vals,
          photos,
          attachs,
          buildingConditionIds: listing.buildingConditions.map((b) => b.conditionId),
        }}
      />
    </div>
  );
}
