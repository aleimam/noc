// "Sell your land" page content. The schema + defaults live in @noc/config (shared with
// the New Obour backend editor); this reads the admin override from Setting('alsawarey.sell').
import { prisma } from '@noc/db';
import { DEFAULT_SELL_CONTENT, type SellContent } from '@noc/config';

export type { SellContent };
export const SELL_KEY = 'alsawarey.sell';

export async function getSellContent(): Promise<SellContent> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SELL_KEY } });
    if (!row?.value) return DEFAULT_SELL_CONTENT;
    const parsed = JSON.parse(row.value) as Partial<SellContent>;
    return { ...DEFAULT_SELL_CONTENT, ...parsed };
  } catch {
    return DEFAULT_SELL_CONTENT;
  }
}
