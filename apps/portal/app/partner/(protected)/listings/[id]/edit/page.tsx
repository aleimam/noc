import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePartner } from '@noc/auth';
import { loadPartnerCatalog, loadPartnerListing } from '@noc/partner-portal/server';
import { LeanListingForm } from '@noc/partner-portal';

export const dynamic = 'force-dynamic';

/** Partner: edit one of their own listings via the shared lean form — content changes re-enter review. */
export default async function PartnerEditListing({ params }: { params: Promise<{ id: string }> }) {
  const { ownerId } = await requirePartner();
  const { id } = await params;
  const t = await getTranslations('mp');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [catalog, listing] = await Promise.all([loadPartnerCatalog(ownerId), loadPartnerListing(id, ownerId)]);
  if (!listing) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}: {listing.title}</h1>
        <a href="/partner" className="text-sm text-accent">← {L('إعلاناتي', 'My listings')}</a>
      </div>
      <p className="rounded-lg border border-gold-300/50 bg-gold/10 p-3 text-sm">
        {L('تعديل البيانات يعيد الإعلان لمراجعة الإدارة قبل نشره من جديد.', 'Content changes send the listing back to staff review before republishing.')}
      </p>
      <LeanListingForm catalog={catalog} initial={listing} locale={locale} />
    </div>
  );
}
