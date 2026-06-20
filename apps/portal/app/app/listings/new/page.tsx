import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { ListingForm } from '../ListingForm';
import { loadCatalog } from '../catalog';

export default async function NewListing() {
  const session = await auth();
  if (!session?.user) redirect('/app/login');

  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const { propertyTypes, sections, attributes } = await loadCatalog();
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('newOffer')}</h1>
        <a href="/app/listings" className="text-sm text-accent">← {t('myOffers')}</a>
      </div>
      <ListingForm
        propertyTypes={propertyTypes}
        sections={sections}
        attributes={attributes}
        locale={locale}
        initial={{
          propertyTypeId: '',
          title: '',
          description: '',
          price: '',
          priceNote: '',
          contactPhone: dbUser?.phone ?? '',
          contactWhatsapp: true,
          ownerId: '',
          ownerName: '',
          ownerType: 'OWNER',
          showOnBrokerage: false,
          vals: {},
          photos: [],
        }}
      />
    </main>
  );
}
