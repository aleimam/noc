'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

const ALLOWED = new Set(['site.mobileMenu', 'copyright_newobour', 'copyright_alsawarey', 'site.whatsappHelp']);

export async function saveSiteSettings(values: Record<string, string>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    for (const [key, value] of Object.entries(values)) {
      if (!ALLOWED.has(key)) continue;
      const v = (value ?? '').trim();
      if (v) await prisma.setting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
      else await prisma.setting.deleteMany({ where: { key } });
    }
    revalidatePath('/admin/settings/site');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    console.error('saveSiteSettings failed', e);
    return { ok: false, error: 'failed' };
  }
}
