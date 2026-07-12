'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import type { BrandTheme } from '@noc/config';

type Result = { ok: true } | { ok: false; error: string };
type Brand = 'newobour' | 'alsawarey';

export async function saveBrandTheme(brand: Brand, theme: BrandTheme): Promise<Result> {
  await requirePermission('appearance', 'UPDATE');
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(theme)) if (v !== '' && v != null) clean[k] = v;
    const key = `theme.${brand}`;
    await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(clean) }, create: { key, value: JSON.stringify(clean) } });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/settings/theme');
    return { ok: true };
  } catch (e) {
    console.error('saveBrandTheme failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function resetBrandTheme(brand: Brand): Promise<Result> {
  await requirePermission('appearance', 'UPDATE');
  try {
    await prisma.setting.deleteMany({ where: { key: `theme.${brand}` } });
    revalidatePath('/', 'layout');
    revalidatePath('/admin/settings/theme');
    return { ok: true };
  } catch (e) {
    console.error('resetBrandTheme failed', e);
    return { ok: false, error: 'failed' };
  }
}
