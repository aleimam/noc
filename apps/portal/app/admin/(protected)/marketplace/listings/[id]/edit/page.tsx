import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog, buildVals, loadListingAttachments, loadListingPapers } from '@/app/account/listings/catalog';
import { getCalculatorConfig } from '@/lib/calculator/config';
import { AreaMapEditor } from '../../../../lands/GeoContentEditors';
import { loadAreaMaps, masterplanClean } from '../../../../lands/geo';
import { PosterPanel } from '../PosterPanel';
import { listListingPosters } from '../poster-actions';

export default async function StaffEditListing({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('listings', 'UPDATE');
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, include: { values: true, buildingConditions: { select: { conditionId: true } } } });
  if (!listing) notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas, buildingConditions } = await loadCatalog();
  const [owners, attachData, calcConfig] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    loadListingAttachments(id),
    getCalculatorConfig(),
  ]);
  const { photos, attachs } = attachData;
  const papers = await loadListingPapers(id);
  const vals = buildVals(listing.values, new Map(attributes.map((a) => [a.id, a.type])));

  // Location map: annotate the listing's neighborhood masterplan (embedded in the poster).
  const tl = await getTranslations('lands');
  const nbMasterplan = await masterplanClean('neighborhood', listing.neighborhoodId);
  const lmaps = await loadAreaMaps('listing', id);
  const posters = await listListingPosters(id);
  // All neighborhoods' masterplans — the in-form annotator follows the picked neighborhood.
  const nbMaps = await prisma.areaMap.findMany({ where: { level: 'neighborhood', kind: 'masterplan' }, select: { areaId: true, cleanPath: true } });

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
        buildingConditions={buildingConditions}
        nbMasterplans={Object.fromEntries(nbMaps.map((m) => [m.areaId, m.cleanPath]))}
        locationAnnotation={lmaps.locationAnnotation}
        savedNeighborhoodId={listing.neighborhoodId}
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
          hasAllocationLetter: listing.hasAllocationLetter,
          allocationLetterDate: listing.allocationLetterDate ?? '',
          allocationPhoto: papers.allocation,
          hasSaleMandate: listing.hasSaleMandate,
          saleMandateDate: listing.saleMandateDate ?? '',
          saleMandatePhoto: papers.mandate,
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

      <section className="space-y-2 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{tl('locationMap')}</h2>
        {listing.neighborhoodId ? (
          <AreaMapEditor level="listing" targetId={id} kind="location" map={lmaps.location} parentMasterplan={nbMasterplan} annotation={lmaps.locationAnnotation} />
        ) : (
          <p className="text-sm opacity-60">{locale === 'ar' ? 'اربط الإعلان بمجاورة أولاً لإنشاء خريطة الموقع.' : 'Link the listing to a neighborhood first to create a location map.'}</p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-graphite/15 p-4">
        <h2 className="font-semibold text-primary">{locale === 'ar' ? 'ملصقات العرض' : 'Listing posters'}</h2>
        <PosterPanel listingId={id} images={posters} locale={locale} stale={listing.postersStale} />
      </section>
    </div>
  );
}
