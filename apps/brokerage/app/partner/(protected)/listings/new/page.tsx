import { getLocale } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { loadPartnerCatalog } from '@noc/partner-portal/server';
import { LeanListingForm } from '@noc/partner-portal';

export const dynamic = 'force-dynamic';

/** Partner: create a new listing via the shared lean form (goes to the moderation queue). */
export default async function NewPartnerListing() {
  const { ownerId } = await requirePartner();
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const catalog = await loadPartnerCatalog(ownerId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-navy-800">{L('إضافة إعلان جديد', 'Add a new listing')}</h1>
      <LeanListingForm catalog={catalog} locale={locale} />
    </div>
  );
}
