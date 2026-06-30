import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { localizeUnit, currency } from '@noc/i18n';
import { LandsTable, type LandRow } from '../LandsTable';

export const dynamic = 'force-dynamic';

const STATUSES = ['DRAFT', 'REFINED', 'READY', 'PUBLISHED', 'ARCHIVED'] as const;
const TYPES = ['SHEETS', 'ALLOCATED'] as const;

export default async function LandsListPage() {
  await requirePermission('lands', 'VIEW');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const lands = await prisma.land.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { neighborhood: { include: { district: true } }, owner: { select: { name: true } } },
  });

  const rows: LandRow[] = lands.map((l) => {
    const area = l.area != null ? Number(l.area) : null;
    const price = l.price != null ? Number(l.price) : null;
    return {
      id: l.id,
      status: l.status,
      landType: l.landType,
      typeLabel: t(`type${l.landType}`),
      location: l.neighborhood
        ? `${L(l.neighborhood.district.nameAr, l.neighborhood.district.nameEn)} · ${L(l.neighborhood.nameAr, l.neighborhood.nameEn)}`
        : l.sheetLocation ?? '—',
      area,
      areaLabel: area != null ? `${area} ${localizeUnit('م²', locale)}` : '—',
      price,
      priceLabel: price != null ? `${price} ${currency(locale)}` : '—',
      ownerLabel: l.ownerKind ? `${t(`kind${l.ownerKind}`)}${l.owner ? ` · ${l.owner.name}` : ''}` : '—',
      statusLabel: t(`status${l.status}`),
      published: l.status === 'PUBLISHED',
    };
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

      <LandsTable
        rows={rows}
        typeOptions={TYPES.map((x) => ({ value: x, label: t(`type${x}`) }))}
        statusOptions={STATUSES.map((x) => ({ value: x, label: t(`status${x}`) }))}
      />
    </div>
  );
}
