import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { CustomersManager } from './CustomersManager';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  await requirePermission('customers', 'VIEW');
  const t = await getTranslations('admin');
  const customers = await prisma.user.findMany({
    where: { type: 'CUSTOMER' },
    orderBy: [{ phoneVerifiedAt: 'asc' }, { createdAt: 'desc' }],
    take: 500,
    select: {
      id: true,
      phone: true,
      name: true,
      isActive: true,
      phoneVerifiedAt: true,
      _count: { select: { rationingFollows: true, landFollows: true, userLands: true } },
    },
  });
  const rows = customers.map((u) => ({
    id: u.id,
    phone: u.phone ?? '',
    name: u.name ?? '',
    isActive: u.isActive,
    verified: !!u.phoneVerifiedAt,
    follows: u._count.rationingFollows + u._count.landFollows,
    lands: u._count.userLands,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsCustomers')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <CustomersManager customers={rows} />
    </div>
  );
}
