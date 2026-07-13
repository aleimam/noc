import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '../ListingForm';
import { loadCatalog } from '../catalog';
import { getCalculatorConfig } from '../../../../lib/calculator/config';

export default async function NewListing({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/account/login');
  // The account dashboard's partnership card deep-links here with the toggle pre-set.
  const sp = await searchParams;
  const presetPartnership = sp.partnership === '1';

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { classifiers, sections, attributes, standardAreas, buildingConditions, partnershipsOn } = await loadCatalog();
  const calcConfig = await getCalculatorConfig();
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
        buildingConditions={buildingConditions}
        partnershipsEnabled={partnershipsOn}
        calcConfig={calcConfig}
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
          isPartnership: presetPartnership,
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
