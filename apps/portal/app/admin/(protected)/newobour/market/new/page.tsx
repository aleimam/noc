import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog } from '@/app/account/listings/catalog';

export const dynamic = 'force-dynamic';

// Same listing form as Al Sawarey, but reached from the New Obour section and defaulting
// to New-Obour-only (showOnBrokerage off — staff can still toggle it on to also publish
// to Al Sawarey). Returns to the New Obour market after saving.
export default async function NewObourNewListing() {
  await requirePermission('listings', 'CREATE');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const { classifiers, sections, attributes, standardAreas, buildingConditions } = await loadCatalog();
  const owners = await prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('سوق العبور الجديدة — عرض جديد', 'New Obour market — new listing')}</h1>
        <a href="/admin/newobour/market" className="text-sm text-accent">← {L('سوق العبور الجديدة', 'New Obour market')}</a>
      </div>
      <ListingForm
        staffMode
        returnTo="/admin/newobour/market"
        owners={owners.map((o) => ({ id: o.id, name: o.name, type: o.type }))}
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        buildingConditions={buildingConditions}
        initial={{
          typeOptionId: '',
          purposeOptionId: '',
          conditionOptionId: '',
          title: '',
          description: '',
          area: '',
          price: '',
          priceUnit: 'TOTAL',
          priceNegotiable: false,
          priceNote: '',
          contactPhone: '',
          contactWhatsapp: true,
          ownerId: '',
          ownerName: '',
          ownerType: 'PERSONAL',
          showOnBrokerage: false,
          vals: {},
          photos: [],
          attachs: {},
        }}
      />
    </div>
  );
}
