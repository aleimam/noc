import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { StaffManager } from './StaffManager';

export const dynamic = 'force-dynamic';

const SECTION_KEYS = ['marketplace', 'sheets', 'lands', 'staff', 'customers', 'partners', 'settings', 'media', 'homepage'];

export default async function UsersPage() {
  await requirePermission('staff', 'VIEW');
  const t = await getTranslations('admin');

  const staff = await prisma.user.findMany({
    where: { type: 'STAFF' },
    orderBy: { createdAt: 'asc' },
    include: { roles: { include: { role: true } }, directPerms: { include: { permission: true } } },
  });
  const rows = staff.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    name: u.name ?? '',
    isActive: u.isActive,
    superAdmin: u.roles.some((r) => r.role.key === 'SUPER_ADMIN'),
    sections: [...new Set(u.directPerms.filter((p) => p.permission.action === 'MANAGE').map((p) => p.permission.section))],
  }));
  const sectionOptions = SECTION_KEYS.map((k) => ({ key: k, label: t(`section_${k}`) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsUsers')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <StaffManager staff={rows} sectionOptions={sectionOptions} />
    </div>
  );
}
