import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog, loadAlsawareyDefaults } from '@/app/account/listings/catalog';

export default async function StaffNewListing() {
  await requirePermission('listings', 'CREATE');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas, buildingConditions } = await loadCatalog();
  const [owners, settings, alsawareyDefaults, nbMaps] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
    // Default classifiers for a new Al Sawarey listing (staff can still change them).
    loadAlsawareyDefaults(),
    // Neighborhood masterplans feed the in-form location-map annotator.
    prisma.areaMap.findMany({ where: { level: 'neighborhood', kind: 'masterplan' }, select: { areaId: true, cleanPath: true } }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  // Default the owner to our own "US" owner (Al Sawarey) when one exists.
  const defaultOwnerId = owners.find((o) => o.type === 'US')?.id ?? '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('addLand')}</h1>
        <a href="/admin/marketplace/listings" className="text-sm text-accent">← {t('moderation')}</a>
      </div>
      <ListingForm
        staffMode
        alsawareyDefaults={alsawareyDefaults}
        owners={owners.map((o) => ({ id: o.id, name: o.name, type: o.type }))}
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        buildingConditions={buildingConditions}
        nbMasterplans={Object.fromEntries(nbMaps.map((m) => [m.areaId, m.cleanPath]))}
        initial={{
          typeOptionId: alsawareyDefaults.typeOptionId,
          purposeOptionId: alsawareyDefaults.purposeOptionId,
          conditionOptionId: alsawareyDefaults.conditionOptionId,
          title: '',
          description: '',
          area: '',
          price: '',
          priceUnit: 'TOTAL',
          priceNegotiable: false,
          priceNote: '',
          contactPhone: sett.alswarey_phone ?? '',
          contactWhatsapp: !!sett.alswarey_whatsapp,
          ownerId: defaultOwnerId,
          ownerName: '',
          ownerType: 'PERSONAL',
          showOnBrokerage: true,
          vals: {},
          photos: [],
          attachs: {},
        }}
      />
    </div>
  );
}
