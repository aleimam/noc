'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import type { StorefrontContent } from '@noc/config';

const KEY = 'alsawarey.storefront';

export async function saveStorefront(content: StorefrontContent): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('storefront', 'UPDATE');
  try {
    await prisma.setting.upsert({
      where: { key: KEY },
      update: { value: JSON.stringify(content) },
      create: { key: KEY, value: JSON.stringify(content) },
    });
    revalidatePath('/admin/marketplace/storefront');
    return { ok: true };
  } catch (e) {
    console.error('saveStorefront failed', e);
    return { ok: false, error: 'failed' };
  }
}
