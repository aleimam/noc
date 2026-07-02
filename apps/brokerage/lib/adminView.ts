import { cookies } from 'next/headers';
import { verifyAdminToken } from '@noc/auth';
import { prisma, type OwnerType } from '@noc/db';

export const ADMIN_COOKIE = 'sw_admin';

/** Is the current viewer a staff member in "admin view"? Returns the staff id or null. */
export async function getAdminViewer(): Promise<string | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminToken(token);
}

export type OwnerInfo = {
  ownerName: string | null;
  ownerType: OwnerType | null;
  phone1: string | null;
  phone1Whatsapp: boolean;
  phone2: string | null;
  phone2Whatsapp: boolean;
  details: string | null;
  sellerName: string | null;
  createdByName: string | null;
};

/** Full owner details for one listing (staff admin view only). */
export async function ownerDetailFor(listingId: string): Promise<OwnerInfo | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      ownerName: true,
      ownerType: true,
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
  };
}

/** Compact owner label per listing id (name + first phone) for card badges. */
export async function ownerBadges(ids: string[]): Promise<Map<string, { name: string; phone: string | null }>> {
  const map = new Map<string, { name: string; phone: string | null }>();
  if (!ids.length) return map;
  const rows = await prisma.listing.findMany({
    where: { id: { in: ids } },
    select: { id: true, ownerName: true, owner: { select: { name: true, phone1: true } } },
  });
  for (const r of rows) {
    const name = r.owner?.name ?? r.ownerName ?? '';
    if (name || r.owner?.phone1) map.set(r.id, { name: name || '—', phone: r.owner?.phone1 ?? null });
  }
  return map;
}
