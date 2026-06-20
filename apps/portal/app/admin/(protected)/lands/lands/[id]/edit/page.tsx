import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { LandForm } from '../../../LandForm';

export const dynamic = 'force-dynamic';

export default async function EditLand({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('lands', 'UPDATE');
  const { id } = await params;
  const land = await prisma.land.findUnique({ where: { id } });
  if (!land) notFound();

  const t = await getTranslations('lands');
  const locale = (await getLocale()) as 'ar' | 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  const [neighborhoods, owners, photos] = await Promise.all([
    prisma.neighborhood.findMany({
      orderBy: [{ districtId: 'asc' }, { order: 'asc' }],
      include: { district: { select: { nameAr: true, nameEn: true } }, blocks: { orderBy: { order: 'asc' }, select: { id: true, name: true } } },
    }),
    prisma.owner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.attachment.findMany({ where: { ownerType: 'Land', ownerId: id }, select: { id: true, path: true, originalName: true } }),
  ]);
  const nbs = neighborhoods.map((n) => ({ id: n.id, label: `${L(n.district.nameAr, n.district.nameEn)} · ${L(n.nameAr, n.nameEn)}`, blocks: n.blocks }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('edit')}</h1>
        <a href="/admin/lands/lands" className="text-sm text-accent">← {t('landRecords')}</a>
      </div>
      <LandForm
        locale={locale}
        neighborhoods={nbs}
        owners={owners}
        initial={{
          id: land.id,
          landType: land.landType,
          neighborhoodId: land.neighborhoodId ?? '',
          blockId: land.blockId ?? '',
          pieceNo: land.pieceNo ?? '',
          sheetLocation: land.sheetLocation ?? '',
          area: land.area != null ? String(land.area) : '',
          allocationDate: land.allocationDate ? land.allocationDate.toISOString().slice(0, 10) : '',
          utilitiesStatus: land.utilitiesStatus ?? '',
          price: land.price != null ? String(land.price) : '',
          ownerKind: land.ownerKind ?? 'PERSONAL',
          ownerId: land.ownerId ?? '',
          details: land.details ?? '',
          status: land.status,
          photos: photos.map((p) => ({ id: p.id, path: p.path, originalName: p.originalName })),
        }}
      />
    </div>
  );
}
