import { getTranslations } from 'next-intl/server';
import { auth, requirePermission, SUPER_ADMIN_KEY, WILDCARD } from '@noc/auth';
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

  // Only an existing SUPER_ADMIN may hand out SUPER_ADMIN — hide the option for everyone else
  // (upsertStaff enforces this server-side too; this just keeps the UI honest).
  const session = await auth();
  const isSuperAdmin = (session?.user?.perms ?? []).includes(WILDCARD);
  const roleOptions = isSuperAdmin ? roles : roles.filter((r) => r.key !== SUPER_ADMIN_KEY);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary">{t('settingsUsers')}</h1>
        <a href="/admin/settings" className="text-sm text-accent">← {t('settings')}</a>
      </div>
      <StaffManager staff={rows} roleOptions={roleOptions} selfId={session?.user?.id ?? ''} />
    </div>
  );
}
