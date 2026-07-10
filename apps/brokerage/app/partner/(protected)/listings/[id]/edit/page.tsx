import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requirePartner } from '@noc/auth';
import { loadPartnerCatalog, loadPartnerListing } from '@noc/partner-portal/server';
import { LeanListingForm } from '@noc/partner-portal';

export const dynamic = 'force-dynamic';

/** Partner: edit one of their own listings via the shared lean form (re-queues to moderation). */
export default async function EditPartnerListing({ params }: { params: Promise<{ id: string }> }) {
  const { ownerId } = await requirePartner();
  const { id } = await params;
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [catalog, listing] = await Promise.all([loadPartnerCatalog(ownerId), loadPartnerListing(id, ownerId)]);
  if (!listing) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-navy-800">{L('تعديل الإعلان', 'Edit listing')}</h1>
      <LeanListingForm catalog={catalog} initial={listing} locale={locale} />
    </div>
  );
}
