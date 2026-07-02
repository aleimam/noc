import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '../ListingForm';
import { loadCatalog } from '../catalog';

export default async function NewListing() {
  const session = await auth();
  if (!session?.user) redirect('/account/login');

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas } = await loadCatalog();
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('newOffer')}</h1>
        <a href="/account/listings" className="text-sm text-accent">← {t('myOffers')}</a>
      </div>
      <ListingForm
        classifiers={classifiers}
        sections={sections}
        attributes={attributes}
        locale={locale}
        standardAreas={standardAreas}
        initial={{
          typeOptionId: '',
          purposeOptionId: '',
          conditionOptionId: '',
          title: '',
          description: '',
          price: '',
          priceUnit: 'TOTAL',
          priceNegotiable: false,
          priceNote: '',
          contactPhone: dbUser?.phone ?? '',
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
