import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/app/listings/ListingForm';
import { loadCatalog } from '@/app/app/listings/catalog';

export default async function StaffNewListing() {
  await requirePermission('marketplace', 'CREATE');
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes } = await loadCatalog();
  const [owners, settings] = await Promise.all([
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, type: true } }),
    prisma.setting.findMany({ where: { key: { in: ['alswarey_phone', 'alswarey_whatsapp'] } } }),
  ]);
  const sett = Object.fromEntries(settings.map((s) => [s.key, s.value]));

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
        initial={{
          typeOptionId: '',
          purposeOptionId: '',
          conditionOptionId: '',
          title: '',
          description: '',
          price: '',
          priceNote: '',
          contactPhone: sett.alswarey_phone ?? '',
          contactWhatsapp: !!sett.alswarey_whatsapp,
          ownerId: '',
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
