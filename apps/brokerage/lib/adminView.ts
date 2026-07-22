import { cookies } from 'next/headers';
import { verifyAdminToken, getEffectivePermissions, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';

// WHAT the admin view exposes (owner contact + the internal floor price) is shared with the
// portal so the two fronts can't drift; only the viewer check below is app-specific, because
// Al Sawarey is a separate domain and needs the signed cookie.
export {
  adminDetailFor as ownerDetailFor,
  adminBadges as ownerBadges,
  type AdminListingInfo as OwnerInfo,
  type AdminBadge,
} from '@noc/partner-portal/admin-details';

export const ADMIN_COOKIE = 'sw_admin';

/**
 * Is the current viewer a staff member in "admin view"? Returns the staff id or null.
 *
 * The token is only signed + time-limited (8h). Verifying it alone meant that deactivating a
 * staff account, or revoking their owner grant, left an already-issued cookie authorizing owner
 * phone numbers and details for the rest of its life. Re-check the live row on every read.
 */
export async function getAdminViewer(): Promise<string | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const staffId = verifyAdminToken(token);
  if (!staffId) return null;

  const live = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, type: true, isActive: true },
  });
  if (!live || live.type !== 'STAFF' || !live.isActive) return null;
  const perms = await getEffectivePermissions(live.id);
  return hasPermission(perms, 'owners', 'VIEW') ? live.id : null;
}

// (ownerDetailFor / ownerBadges / OwnerInfo are re-exported at the top from
//  @noc/partner-portal/admin-details — shared with the New Obour front.)
