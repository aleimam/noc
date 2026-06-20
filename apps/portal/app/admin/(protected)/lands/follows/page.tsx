import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

export const dynamic = 'force-dynamic';

function fmt(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export default async function FollowsPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const follows = await prisma.landFollow.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { neighborhood: { include: { district: true } }, district: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">
          {t('follows')} <span className="text-base font-normal opacity-60">({follows.length})</span>
        </h1>
        <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
      </div>

      {follows.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noFollows')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('name')}</th>
                <th className="p-2 text-start">{t('phone')}</th>
                <th className="p-2 text-start">{t('neighborhood')}</th>
                <th className="p-2 text-start">{t('when')}</th>
              </tr>
            </thead>
            <tbody>
              {follows.map((f) => (
                <tr key={f.id} className="border-t border-graphite/10">
                  <td className="p-2">{f.name ?? '—'}</td>
                  <td className="p-2" dir="ltr">{f.phone}</td>
                  <td className="p-2">
                    {f.neighborhood
                      ? `${L(f.neighborhood.district.nameAr, f.neighborhood.district.nameEn)} · ${L(f.neighborhood.nameAr, f.neighborhood.nameEn)}`
                      : f.district
                        ? L(f.district.nameAr, f.district.nameEn)
                        : '—'}
                  </td>
                  <td className="p-2" dir="ltr">{fmt(f.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
