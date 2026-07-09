import { prisma } from '@noc/db';

/** May this partner browse (view-only) all our published sell offers? True only when the
 *  global switch (Setting `partner.browseListings`) is on AND the partner's own flag is on. */
export async function partnerCanBrowseListings(ownerId: string): Promise<boolean> {
  const [global, owner] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'partner.browseListings' }, select: { value: true } }),
    prisma.owner.findUnique({ where: { id: ownerId }, select: { canBrowseListings: true } }),
  ]);
  return global?.value === 'true' && (owner?.canBrowseListings ?? false);
}
