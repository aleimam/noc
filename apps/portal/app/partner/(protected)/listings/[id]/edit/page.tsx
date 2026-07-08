import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog, buildVals, loadListingAttachments } from '@/app/account/listings/catalog';

export const dynamic = 'force-dynamic';

/** Partner: edit one of their own listings — content changes re-enter staff review. */
export default async function PartnerEditListing({ params }: { params: Promise<{ id: string }> }) {
  const { ownerId } = await requirePartner();
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { values: true, buildingConditions: { select: { conditionId: true } } },
  });
  if (!listing || listing.ownerId !== ownerId) notFound();

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const [{ classifiers, sections, attributes, standardAreas, buildingConditions }, grants, attachData] = await Promise.all([
    loadCatalog(),
    prisma.ownerAllowedCategory.findMany({ where: { ownerId }, select: { optionId: true } }),
    loadListingAttachments(id),
  ]);
  const granted = new Set(grants.map((g) => g.optionId));
  // The current Type stays selectable even if its grant was later revoked (editing an
  // existing listing must not dead-end); NEW types remain grant-restricted.
  if (listing.typeOptionId) granted.add(listing.typeOptionId);
  const restricted = classifiers.map((c) => (c.key === 'type' ? { ...c, options: c.options.filter((o) => granted.has(o.id)) } : c));
  const { photos, attachs } = attachData;
  const vals = buildVals(listing.values, new Map(attributes.map((a) => [a.id, a.type])));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {listing.title}</h1>
        <a href="/partner" className="text-sm text-accent">← {L('لوحتي', 'Dashboard')}</a>
      </div>
      <p className="rounded-lg border border-gold-300/50 bg-gold/10 p-3 text-sm">
        {L('تعديل البيانات يعيد الإعلان لمراجعة الإدارة قبل نشره من جديد.', 'Content changes send the listing back to staff review before republishing.')}
      </p>
      <ListingForm
        partnerMode
        classifiers={restricted}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        buildingConditions={buildingConditions}
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
          isPartnership: listing.isPartnership,
          partnershipType: listing.partnershipType ?? '',
          partnershipNote: listing.partnershipNote ?? '',
          contactPhone: listing.contactPhone,
          contactWhatsapp: listing.contactWhatsapp,
          ownerId: '',
          ownerName: '',
          ownerType: 'PERSONAL',
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
