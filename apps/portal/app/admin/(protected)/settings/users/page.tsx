import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { StaffManager } from './StaffManager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requirePermission('staff', 'VIEW');
  const t = await getTranslations('admin');

  const [staff, roles] = await Promise.all([
    prisma.user.findMany({
      where: { type: 'STAFF' },
      orderBy: { createdAt: 'asc' },
      include: { roles: { include: { role: true } } },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' }, select: { key: true, name: true } }),
  ]);
  const rows = staff.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: u.name ?? '',
    isActive: u.isActive,
    roleKeys: u.roles.map((r) => r.role.key),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsUsers')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <StaffManager staff={rows} roleOptions={roles} />
    </div>
  );
}
