// ALSWARY storefront content (homepage + global chrome). Schema, defaults, and the
// shape-preserving merge live in @noc/config (shared with the New Obour backend editor);
// this reads the admin override from Setting('alsawarey.storefront').
import { prisma } from '@noc/db';
import { DEFAULT_STOREFRONT, mergeStorefront, type StorefrontContent } from '@noc/config';

export type { StorefrontContent };
export const STOREFRONT_KEY = 'alsawarey.storefront';

export async function getStorefront(): Promise<StorefrontContent> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: STOREFRONT_KEY } });
    if (!row?.value) return DEFAULT_STOREFRONT;
    return mergeStorefront(JSON.parse(row.value));
  } catch {
    return DEFAULT_STOREFRONT;
  }
}
