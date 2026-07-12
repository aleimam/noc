import { getLocale } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { getSeoIntros, getSocialLinksRaw, SEO_INTRO_PAGE_KEYS } from '../../../../lib/seoContent';
import { SeoEditor } from './SeoEditor';

export const dynamic = 'force-dynamic';

const PAGE_LABELS: Record<string, { ar: string; en: string }> = {
  home: { ar: 'الصفحة الرئيسية', en: 'Home page' },
  market: { ar: 'السوق', en: 'Marketplace' },
  explore: { ar: 'استكشاف الأحياء', en: 'Explore' },
};

export default async function SeoAdminPage() {
  await requirePermission('content', 'VIEW');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [intros, socialNewobour, socialAlsawarey] = await Promise.all([
    getSeoIntros(SEO_INTRO_PAGE_KEYS),
    getSocialLinksRaw('newobour'),
    getSocialLinksRaw('alsawarey'),
  ]);

  const introItems = SEO_INTRO_PAGE_KEYS.map((pageKey) => ({
    pageKey,
    labelAr: PAGE_LABELS[pageKey]!.ar,
    labelEn: PAGE_LABELS[pageKey]!.en,
    value: intros[pageKey]!,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{L('محتوى SEO', 'SEO content')}</h1>
        <a href="/admin" className="text-sm text-accent">← {L('لوحة التحكم', 'Dashboard')}</a>
      </div>
      <p className="text-sm opacity-70">
        {L(
          'فقرات تعريفية للصفحات العامة وروابط التواصل الاجتماعي. تُحسّن ظهور الموقع في محركات البحث ونتائج الذكاء الاصطناعي. مقاطع المدن والأحياء تُحرَّر من صفحة كل منها في الدليل الجغرافي.',
          'Intro paragraphs for public pages and social profile links — these improve visibility in search engines and AI answers. Per-city and per-district intros are edited from each area page in the geo directory.',
        )}
      </p>
      <SeoEditor intros={introItems} socialNewobour={socialNewobour} socialAlsawarey={socialAlsawarey} locale={locale} />
    </div>
  );
}
