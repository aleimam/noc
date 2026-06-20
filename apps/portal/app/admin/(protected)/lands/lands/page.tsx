import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { localizeUnit, currency } from '@noc/i18n';
import { LandRowActions } from '../LandRowActions';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-graphite/10 text-graphite',
  REFINED: 'bg-gold/20 text-graphite',
  READY: 'bg-navy/10 text-primary',
  PUBLISHED: 'bg-green/15 text-green',
  ARCHIVED: 'bg-graphite/10 opacity-60',
};

export default async function LandsListPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const lands = await prisma.land.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { neighborhood: { include: { district: true } }, owner: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('landRecords')}</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/lands/lands/new" className="rounded-md bg-primary px-3 py-1.5 text-sm text-soft">+ {t('addLand')}</a>
          <a href="/admin/lands" className="text-sm text-accent">← {t('title')}</a>
        </div>
      </div>

      {lands.length === 0 ? (
        <p className="py-12 text-center opacity-60">{t('noLands')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-graphite/15">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="opacity-60">
                <th className="p-2 text-start">{t('landType')}</th>
                <th className="p-2 text-start">{t('neighborhood')}</th>
                <th className="p-2 text-start">{t('area')}</th>
                <th className="p-2 text-start">{t('price')}</th>
                <th className="p-2 text-start">{t('ownerKind')}</th>
                <th className="p-2 text-start">{t('status')}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {lands.map((l) => (
                <tr key={l.id} className="border-t border-graphite/10">
                  <td className="p-2">{t(`type${l.landType}`)}</td>
                  <td className="p-2">
                    {l.neighborhood
                      ? `${L(l.neighborhood.district.nameAr, l.neighborhood.district.nameEn)} · ${L(l.neighborhood.nameAr, l.neighborhood.nameEn)}`
                      : l.sheetLocation ?? '—'}
                  </td>
                  <td className="p-2" dir="ltr">{l.area != null ? `${String(l.area)} ${localizeUnit('م²', locale)}` : '—'}</td>
                  <td className="p-2" dir="ltr">{l.price != null ? `${String(l.price)} ${currency(locale)}` : '—'}</td>
                  <td className="p-2">{l.ownerKind ? `${t(`kind${l.ownerKind}`)}${l.owner ? ` · ${l.owner.name}` : ''}` : '—'}</td>
                  <td className="p-2"><span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[l.status] ?? ''}`}>{t(`status${l.status}`)}</span></td>
                  <td className="p-2 text-end"><LandRowActions id={l.id} published={l.status === 'PUBLISHED'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
