import { getLocale, getTranslations } from 'next-intl/server';
import { prisma } from '@noc/db';
import { localizeUnit } from '@noc/i18n';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('lands');
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  const m2 = localizeUnit('م²', locale);

  const districts = await prisma.district.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { neighborhoods: { where: { isActive: true }, orderBy: { order: 'asc' } } },
  });
  const withNb = districts.filter((d) => d.neighborhoods.length > 0);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">{t('exploreTitle')}</h1>
          <p className="text-sm opacity-70">{t('exploreManage')}</p>
        </div>
        <a href="/" className="text-sm text-accent">← {t('back')}</a>
      </div>

      {withNb.length === 0 && <p className="py-12 text-center opacity-60">{t('noNeighborhoods')}</p>}

      {withNb.map((d) => (
        <section key={d.id} className="space-y-3">
          <h2 className="text-lg font-bold text-primary">{L(d.nameAr, d.nameEn)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.neighborhoods.map((n) => {
              const areas = (n.areas as number[] | null) ?? [];
              return (
                <a key={n.id} href={`/explore/${n.id}`} className="rounded-lg border border-graphite/15 p-4 transition-colors hover:border-accent">
                  <div className="font-semibold">{L(n.nameAr, n.nameEn)}</div>
                  <div className="mt-1 text-xs opacity-70">
                    {n.assortedAreas ? t('assorted') : areas.length ? `${areas.join('، ')} ${m2}` : '—'}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
