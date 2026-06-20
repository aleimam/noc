import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { PartnersManager } from './PartnersManager';

export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
  await requirePermission('partners', 'VIEW');
  const t = await getTranslations('admin');
  const partners = await prisma.user.findMany({
    where: { type: 'PARTNER' },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, name: true, phone: true, email: true, partnerKind: true, isActive: true },
  });
  const rows = partners.map((u) => ({
    id: u.id,
    name: u.name ?? '',
    phone: u.phone ?? '',
    email: u.email ?? '',
    partnerKind: u.partnerKind ?? 'BROKER',
    isActive: u.isActive,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsPartners')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <PartnersManager partners={rows} />
    </div>
  );
}
