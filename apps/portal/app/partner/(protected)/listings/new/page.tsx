import { getLocale, getTranslations } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '@/app/account/listings/ListingForm';
import { loadCatalog } from '@/app/account/listings/catalog';

export const dynamic = 'force-dynamic';

/** Partner: create a listing — Type restricted to the admin-granted categories;
 *  submission enters the staff moderation queue (PENDING). */
export default async function PartnerNewListing() {
  const { ownerId } = await requirePartner();
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [{ classifiers, sections, attributes, standardAreas, buildingConditions }, grants, owner] = await Promise.all([
    loadCatalog(),
    prisma.ownerAllowedCategory.findMany({ where: { ownerId }, select: { optionId: true } }),
    prisma.owner.findUnique({ where: { id: ownerId }, select: { phone1: true } }),
  ]);
  const granted = new Set(grants.map((g) => g.optionId));

  if (granted.size === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-lg border border-ink-200 bg-white p-8 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold text-navy-800">{L('لا توجد فئات مسموح بالنشر فيها بعد', 'No posting categories granted yet')}</h1>
        <p className="text-sm text-ink-500">{L('تواصل مع الإدارة لتفعيل فئات النشر لحسابك.', 'Contact us to enable posting categories for your account.')}</p>
        <a href="/partner" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-soft">{L('رجوع للوحتي', 'Back to dashboard')}</a>
      </div>
    );
  }

  // Restrict the Type list to the granted categories (Purpose/Condition cascade follows).
  const restricted = classifiers.map((c) => (c.key === 'type' ? { ...c, options: c.options.filter((o) => granted.has(o.id)) } : c));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('newOffer')}</h1>
        <a href="/partner" className="text-sm text-accent">← {L('لوحتي', 'Dashboard')}</a>
      </div>
      <p className="rounded-lg border border-gold-300/50 bg-gold/10 p-3 text-sm">
        {L('سيُراجع الإعلان من الإدارة قبل النشر.', 'Your listing will be reviewed by staff before it goes public.')}
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
          contactPhone: owner?.phone1 ?? '',
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
