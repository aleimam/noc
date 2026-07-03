import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { pick } from '@noc/i18n';
import { SiteShell } from '../../_components/SiteShell';

export const dynamic = 'force-dynamic';

export default async function ConditionsList() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const rows = await prisma.buildingCondition.findMany({ where: { published: true }, orderBy: { order: 'asc' } });

  return (
    <SiteShell active="guide">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="text-3xl font-black text-navy-800 dark:text-soft">{locale === 'en' ? 'Building conditions' : 'اشتراطات البناء'}</h1>
          <p className="mt-1 text-ink-600">{locale === 'en' ? 'Building requirements & areas per land unit — New Obour City.' : 'اشتراطات ومسطحات البناء لكل وحدة أرض — مدينة العبور الجديدة.'}</p>
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center opacity-60">{locale === 'en' ? 'Nothing yet.' : 'لا يوجد بعد.'}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <Link key={r.id} href={`/guide/conditions/${r.slug}`} className="rounded-2xl border border-ink-200 bg-white p-5 transition hover:border-gold hover:shadow-md dark:bg-navy-900">
                <div className="text-xl font-bold text-navy-800 dark:text-soft">{pick(r.unitLabelAr, r.unitLabelEn, locale)}</div>
                <div className="mt-1 text-sm text-ink-600">{pick(r.titleAr, r.titleEn, locale)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
