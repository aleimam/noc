import { prisma, type OwnerType } from '@noc/db';

/**
 * Internal listing details shown ONLY to staff in "admin view" on the PUBLIC fronts of both
 * sites. A visitor must never reach any of this: every caller gates on its app's own viewer
 * check first, and both of those re-read the live `User` row (STAFF + isActive + `owners:VIEW`)
 * on every request, so deactivating staff or revoking a grant takes effect immediately.
 *
 * The two fronts authenticate the viewer DIFFERENTLY — Al Sawarey is a separate domain, so it
 * needs the signed `sw_admin` cookie, while New Obour's admin and public site share one origin
 * and one NextAuth session. The data shape lives here so they can only ever differ in HOW the
 * viewer is verified, never in WHAT gets exposed.
 */
export type AdminListingInfo = {
  ownerName: string | null;
  ownerType: OwnerType | null;
  phone1: string | null;
  phone1Whatsapp: boolean;
  phone2: string | null;
  phone2Whatsapp: boolean;
  details: string | null;
  sellerName: string | null;
  createdByName: string | null;
  /** Internal floor / walk-away price (أقل سعر). Admin view only — NEVER rendered to a visitor. */
  lowestPrice: number | null;
};

/** Full internal details for one listing (admin view only). */
export async function adminDetailFor(listingId: string): Promise<AdminListingInfo | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      ownerName: true,
      ownerType: true,
      lowestPrice: true,
      owner: { select: { name: true, type: true, phone1: true, phone1Whatsapp: true, phone2: true, phone2Whatsapp: true, details: true } },
      seller: { select: { name: true, phone: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!l) return null;
  const o = l.owner;
  return {
    ownerName: o?.name ?? l.ownerName ?? null,
    ownerType: o?.type ?? l.ownerType ?? null,
    phone1: o?.phone1 ?? null,
    phone1Whatsapp: o?.phone1Whatsapp ?? false,
    phone2: o?.phone2 ?? null,
    phone2Whatsapp: o?.phone2Whatsapp ?? false,
    details: o?.details ?? null,
    sellerName: l.seller?.name ?? l.seller?.phone ?? null,
    createdByName: l.createdBy?.name ?? l.createdBy?.email ?? null,
    lowestPrice: l.lowestPrice != null ? Number(l.lowestPrice) : null,
  };
}

export type AdminBadge = { name: string; phone: string | null; lowestPrice: number | null };

/** Compact per-listing badge (owner + floor price) for card grids in admin view. */
export async function adminBadges(ids: string[]): Promise<Map<string, AdminBadge>> {
  const map = new Map<string, AdminBadge>();
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return map;
  const rows = await prisma.listing.findMany({
    where: { id: { in: list } },
    select: { id: true, ownerName: true, lowestPrice: true, owner: { select: { name: true, phone1: true } } },
  });
  for (const r of rows) {
    const name = r.owner?.name ?? r.ownerName ?? '';
    const phone = r.owner?.phone1 ?? null;
    const lowestPrice = r.lowestPrice != null ? Number(r.lowestPrice) : null;
    // Keep the row if it carries ANY internal value — a listing can have a floor price with no
    // owner recorded yet, and that badge is still worth showing.
    if (name || phone || lowestPrice != null) map.set(r.id, { name: name || '—', phone, lowestPrice });
  }
  return map;
}
