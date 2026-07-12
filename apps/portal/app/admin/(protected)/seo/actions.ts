'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { SOCIAL_SETTING_KEYS, type SocialBrand } from '@noc/config';
import { seoIntroSettingKey, type SeoIntroValue } from '../../../../lib/seoContent';

type Result = { ok: true } | { ok: false; error: string };

// Accept only the fixed page keys plus per-city/district keys (cuid-ish id after the dot).
const PAGE_KEY_RE = /^(home|market|explore|(city|district)\.[a-z0-9]+)$/i;

export async function saveSeoIntro(pageKey: string, value: SeoIntroValue): Promise<Result> {
  await requirePermission('content', 'UPDATE');
  if (!PAGE_KEY_RE.test(pageKey)) return { ok: false, error: 'bad_key' };
  const clean = { ar: (value.ar ?? '').trim(), en: (value.en ?? '').trim() };
  try {
    const key = seoIntroSettingKey(pageKey);
    await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(clean) }, create: { key, value: JSON.stringify(clean) } });
    revalidatePath('/admin/seo');
    if (pageKey === 'home') revalidatePath('/');
    else if (pageKey === 'market') revalidatePath('/market');
    else if (pageKey === 'explore') revalidatePath('/explore');
    return { ok: true };
  } catch (e) {
    console.error('saveSeoIntro failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function saveSocialLinks(brand: SocialBrand, raw: string): Promise<Result> {
  await requirePermission('content', 'UPDATE');
  if (brand !== 'newobour' && brand !== 'alsawarey') return { ok: false, error: 'bad_brand' };
  try {
    const key = SOCIAL_SETTING_KEYS[brand];
    await prisma.setting.upsert({ where: { key }, update: { value: raw.trim() }, create: { key, value: raw.trim() } });
    revalidatePath('/admin/seo');
    return { ok: true };
  } catch (e) {
    console.error('saveSocialLinks failed', e);
    return { ok: false, error: 'failed' };
  }
}
