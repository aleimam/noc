import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { SiteShell } from '../_components/SiteShell';
import { pageMeta, ldJson } from '../../lib/seo';

export const dynamic = 'force-dynamic';
const SECS = ['LICENSING', 'HANDOVER', 'COMPANIES', 'COSTS'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return pageMeta({
    title: locale === 'en' ? 'Guide — New Obour' : 'الدليل — العبور الجديدة',
    description: locale === 'en'
      ? 'Licensing, handover, developers and costs — answers to common questions about New Obour City.'
      : 'التراخيص والاستلام والشركات والتكاليف — إجابات لأكثر الأسئلة شيوعًا حول مدينة العبور الجديدة.',
    path: '/guide',
    locale,
  });
}

export default async function GuidePage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('guide');
  const L = (ar: string, en: string | null) => (locale === 'ar' ? ar : en || ar);

  const rows = await prisma.guideEntry.findMany({ where: { isActive: true }, orderBy: [{ section: 'asc' }, { order: 'asc' }] });
  // FAQPage structured data: each guide entry is a genuine question (title) + answer (body).
  const faqLd = rows.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: rows.slice(0, 100).map((g) => ({
          '@type': 'Question',
          name: L(g.titleAr, g.titleEn),
          acceptedAnswer: { '@type': 'Answer', text: L(g.bodyAr, g.bodyEn) },
        })),
      }
    : null;
  const bySec = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = bySec.get(r.section) ?? [];
    arr.push(r);
    bySec.set(r.section, arr);
  }

  return (
    <SiteShell active="guide">
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(faqLd) }} />}
      <div className="mx-auto max-w-[900px] space-y-10 px-6 py-10">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-800">{t('title')}</h1>
          <p className="mt-2 text-ink-500">{t('subtitle')}</p>
        </div>

        {/* Building-conditions pages live under /guide/conditions — surface them here. */}
        <a href="/guide/conditions" className="block rounded-lg border border-ink-200 bg-white p-5 shadow-sm transition hover:border-gold hover:shadow-md">
          <h3 className="text-lg font-bold text-navy-800">🏗️ {L('اشتراطات البناء', 'Building conditions')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            {L('اشتراطات ومسطحات البناء لكل وحدة أرض — مدينة العبور الجديدة.', 'Building requirements & areas per land unit — New Obour City.')}
          </p>
        </a>

        {rows.length === 0 && <p className="text-ink-500">{t('none')}</p>}
        {SECS.map((s) => {
          const items = bySec.get(s);
          if (!items?.length) return null;
          return (
            <section key={s} className="space-y-4">
              <h2 className="border-s-4 border-gold ps-3 text-xl font-bold text-navy-800">{t(`sec${s}`)}</h2>
              <div className="space-y-3">
                {items.map((g) => (
                  <div key={g.id} className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-navy-800">{L(g.titleAr, g.titleEn)}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{L(g.bodyAr, g.bodyEn)}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </SiteShell>
  );
}
