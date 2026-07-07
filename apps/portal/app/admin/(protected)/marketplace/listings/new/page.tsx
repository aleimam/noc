import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog } from '@/app/account/listings/catalog';

export default async function StaffNewListing() {
  await requirePermission('marketplace', 'CREATE');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas, buildingConditions } = await loadCatalog();
  const [owners, settings, defOpts] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
    // Default classifiers for a new Al Sawarey listing (staff can still change them).
    prisma.classifierOption.findMany({
      where: { key: { in: ['land_allocated', 'housing_building', 'utility_ongoing'] }, classifier: { key: { in: ['type', 'purpose', 'condition'] } } },
      select: { id: true, key: true, classifier: { select: { key: true } } },
    }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const defOpt = (ck: string, ok: string) => defOpts.find((o) => o.classifier.key === ck && o.key === ok)?.id ?? '';
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
        owners={owners.map((o) => ({ id: o.id, name: o.name, type: o.type }))}
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        buildingConditions={buildingConditions}
        initial={{
          typeOptionId: defOpt('type', 'land_allocated'),
          purposeOptionId: defOpt('purpose', 'housing_building'),
          conditionOptionId: defOpt('condition', 'utility_ongoing'),
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
