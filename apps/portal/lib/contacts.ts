import { prisma } from '@noc/db';
import type { StampCategory } from './stampTypes';

export type Brand = 'newobour' | 'alsawarey';
export const CONTACT_TYPES = ['phone', 'whatsapp', 'email', 'website', 'address', 'facebook', 'instagram'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export type BrandContactItem = { type: string; value: string };

/** Which brand's logo + contacts a photo category belongs to (listing photos + maps are the
 *  Al Sawarey brand; everything else is New Obour). Brand follows the listing's channel. */
export function brandForCategory(cat: StampCategory): Brand {
  return cat === 'listing' || cat === 'map' ? 'alsawarey' : 'newobour';
}

/** Active contacts for a brand, ordered. Falls back to the existing phone/domain settings
 *  (merged) when none have been configured yet, so the footer bar is never empty. */
export async function getBrandContacts(brand: Brand): Promise<BrandContactItem[]> {
  const rows = await prisma.brandContact.findMany({
    where: { brand, isActive: true },
    orderBy: { order: 'asc' },
    select: { type: true, value: true },
  });
  if (rows.length) return rows;
  const s = await prisma.setting.findMany({ where: { key: { in: ['alswarey_phone'] } } });
  const phone = s.find((x) => x.key === 'alswarey_phone')?.value;
  const fallback: BrandContactItem[] = [];
  if (phone) fallback.push({ type: brand === 'alsawarey' ? 'whatsapp' : 'phone', value: phone });
  fallback.push({ type: 'website', value: brand === 'alsawarey' ? 'alsawarey.com' : 'newobour.com' });
  return fallback;
}
