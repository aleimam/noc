import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { LandForm } from '../../LandForm';

export const dynamic = 'force-dynamic';

export default async function NewLand() {
  await requirePermission('lands', 'CREATE');
  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [neighborhoods, owners] = await Promise.all([
    prisma.neighborhood.findMany({
      orderBy: [{ districtId: 'asc' }, { order: 'asc' }],
      include: { district: { select: { nameAr: true, nameEn: true } }, blocks: { orderBy: { order: 'asc' }, select: { id: true, name: true } } },
    }),
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const nbs = neighborhoods.map((n) => ({ id: n.id, label: `${L(n.district.nameAr, n.district.nameEn)} · ${L(n.nameAr, n.nameEn)}`, blocks: n.blocks }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('addLand')}</h1>
        <a href="/admin/lands/lands" className="text-sm text-accent">← {t('landRecords')}</a>
      </div>
      <p className="text-sm opacity-70">{t('openInternal')}</p>
      <LandForm
        locale={locale}
        neighborhoods={nbs}
        owners={owners}
        initial={{
          landType: 'ALLOCATED',
          neighborhoodId: '',
          blockId: '',
          pieceNo: '',
          sheetLocation: '',
          area: '',
          allocationDate: '',
          utilitiesStatus: '',
          price: '',
          ownerKind: 'PERSONAL',
          ownerId: '',
          details: '',
          status: 'DRAFT',
          photos: [],
        }}
      />
    </div>
  );
}
