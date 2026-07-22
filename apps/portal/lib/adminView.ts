import { auth, getEffectivePermissions, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';

// WHAT the admin view exposes (owner contact + the internal floor price) is shared with the
// Al Sawarey front so the two can't drift; only the viewer check below is app-specific.
export {
  adminDetailFor as ownerDetailFor,
  adminBadges as ownerBadges,
  type AdminListingInfo as OwnerInfo,
  type AdminBadge,
} from '@noc/partner-portal/admin-details';

/**
 * Is the current viewer a staff member allowed to see internal listing details on the PUBLIC
 * New Obour pages? Returns the staff id or null.
 *
 * Unlike Al Sawarey — a separate domain, which is why it needs the signed `sw_admin` cookie —
 * the portal's admin and public site are ONE app on ONE origin, so a signed-in staff member
 * already carries a NextAuth session here. Reading it directly avoids inventing a second
 * credential (a token that could outlive a revoked account) for the same person.
 *
 * The live `User` row is re-read on every call, so deactivating staff or revoking the grant
 * takes effect on the next request rather than whenever a token happens to expire.
 */
export async function getAdminViewer(): Promise<string | null> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;

  const live = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, type: true, isActive: true },
  });
  if (!live || live.type !== 'STAFF' || !live.isActive) return null;
  const perms = await getEffectivePermissions(live.id);
  return hasPermission(perms, 'owners', 'VIEW') ? live.id : null;
}
