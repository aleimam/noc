'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

const KEYS = ['ga4_newobour', 'pixel_newobour', 'ga4_alsawarey', 'pixel_alsawarey', 'gsc_newobour', 'gsc_alsawarey'];

export async function saveAnalytics(values: Record<string, string>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  try {
    for (const key of KEYS) {
      const value = (values[key] ?? '').trim();
      if (value) await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      else await prisma.setting.deleteMany({ where: { key } });
    }
    revalidatePath('/admin/settings/analytics');
    return { ok: true };
  } catch (e) {
    console.error('saveAnalytics failed', e);
    return { ok: false, error: 'failed' };
  }
}
