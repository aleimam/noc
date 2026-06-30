'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';

const ALLOWED = new Set([
  'brand_newobour_logo',
  'brand_newobour_logo_dark',
  'brand_newobour_favicon',
  'brand_alsawarey_logo',
  'brand_alsawarey_logo_dark',
  'brand_alsawarey_favicon',
]);

export async function saveBrandAsset(key: string, value: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('settings', 'UPDATE');
  if (!ALLOWED.has(key)) return { ok: false, error: 'bad_key' };
  try {
    if (value) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    } else {
      await prisma.setting.deleteMany({ where: { key } });
    }
    revalidatePath('/admin/settings/branding');
    return { ok: true };
  } catch (e) {
    console.error('saveBrandAsset failed', e);
    return { ok: false, error: 'failed' };
  }
}
