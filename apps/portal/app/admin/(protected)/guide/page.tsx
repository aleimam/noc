import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { GuideManager } from './GuideManager';

export const dynamic = 'force-dynamic';

export default async function AdminGuidePage() {
  await requirePermission('content', 'VIEW');
  const t = await getTranslations('guide');
  const rows = await prisma.guideEntry.findMany({ orderBy: [{ section: 'asc' }, { order: 'asc' }] });
  const initial = rows.map((r) => ({
    id: r.id,
    section: r.section,
    titleAr: r.titleAr,
    titleEn: r.titleEn ?? '',
    bodyAr: r.bodyAr,
    bodyEn: r.bodyEn ?? '',
    order: r.order,
    isActive: r.isActive,
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
      <GuideManager initial={initial} />
    </div>
  );
}
