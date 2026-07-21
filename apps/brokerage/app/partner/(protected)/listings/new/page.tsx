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
  // MIRRORS the portal page: with no granted category the Type list is empty, so the form can be
  // filled in but never submitted. Say so instead of showing a dead end.
  const hasGrant = !!catalog.classifiers.find((c) => c.key === 'type')?.options.some((o) => o.granted);

  if (!hasGrant) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-ink-200 bg-white p-8 text-center dark:border-white/10 dark:bg-navy-800">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold text-navy-800 dark:text-soft">{L('لا توجد فئات مسموح بالنشر فيها بعد', 'No posting categories granted yet')}</h1>
        <p className="text-sm text-ink-500">{L('تواصل مع الإدارة لتفعيل فئات النشر لحسابك.', 'Contact us to enable posting categories for your account.')}</p>
        <a href="/partner" className="inline-flex min-h-10 items-center rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-navy-900">{L('رجوع إلى إعلاناتي', 'Back to my listings')}</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-navy-800 dark:text-soft">{L('إضافة إعلان جديد', 'Add a new listing')}</h1>
      <LeanListingForm catalog={catalog} locale={locale} />
    </div>
  );
}
