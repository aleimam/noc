'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import type { SellContent } from '@noc/config';

const KEY = 'alsawarey.sell';

export async function saveSellContent(content: SellContent): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.setting.upsert({
      where: { key: KEY },
      update: { value: JSON.stringify(content) },
      create: { key: KEY, value: JSON.stringify(content) },
    });
    revalidatePath('/admin/marketplace/sell-content');
    return { ok: true };
  } catch (e) {
    console.error('saveSellContent failed', e);
    return { ok: false, error: 'failed' };
  }
}
