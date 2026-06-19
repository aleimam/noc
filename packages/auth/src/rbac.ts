import { prisma } from '@noc/db';

export const SUPER_ADMIN_KEY = 'SUPER_ADMIN';
export const WILDCARD = '*';

export function permKey(section: string, action: string): string {
  return `${section}:${action}`;
}

/**
 * Compute the set of "section:action" permission keys for a user.
 * Returns ['*'] (wildcard) for any user holding the SUPER_ADMIN role.
 */
export async function getEffectivePermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
      directPerms: { include: { permission: true } },
    },
  });
  if (!user) return [];

  if (user.roles.some((ur) => ur.role.key === SUPER_ADMIN_KEY)) return [WILDCARD];

  const keys = new Set<string>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      keys.add(permKey(rp.permission.section, rp.permission.action));
    }
  }
  for (const up of user.directPerms) {
    keys.add(permKey(up.permission.section, up.permission.action));
  }
  return [...keys];
}

/** Check a permission against a set of keys. MANAGE on a section implies all actions. */
export function hasPermission(perms: string[], section: string, action: string): boolean {
  if (perms.includes(WILDCARD)) return true;
  if (perms.includes(permKey(section, 'MANAGE'))) return true;
  return perms.includes(permKey(section, action));
}
