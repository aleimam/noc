'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@noc/db';
import { requirePermission } from '@noc/auth';
import { POSTER_FONTS } from '../../../../../lib/poster/icons';

type Result = { ok: true } | { ok: false; error: string };

export type PosterThemeInput = {
  navy: string;
  gold: string;
  cream: string;
  tint: string;
  ink: string;
  font: string;
  logoPath: string; // '' = use the brand's default logo setting
  phone: string; // '' = default
  domain: string; // '' = default
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Save one brand's generated-image identity; flags published listings stale so a
 *  regenerate picks the new identity up. */
export async function savePosterTheme(brand: 'newobour' | 'alsawarey', input: PosterThemeInput): Promise<Result> {
  await requirePermission('settings', 'UPDATE');
  for (const k of ['navy', 'gold', 'cream', 'tint', 'ink'] as const) {
    if (!HEX.test(input[k])) return { ok: false, error: 'bad_color' };
  }
  if (!(POSTER_FONTS as readonly string[]).includes(input.font)) return { ok: false, error: 'bad_font' };
  const value = JSON.stringify({
    navy: input.navy, gold: input.gold, cream: input.cream, tint: input.tint, ink: input.ink, font: input.font,
    logoPath: input.logoPath.trim(), phone: input.phone.trim(), domain: input.domain.trim(),
  });
  try {
    const key = `posterTheme.${brand}`;
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    // Identity changed → existing image sets are out of date.
    await prisma.listing.updateMany({ where: { status: 'PUBLISHED' }, data: { postersStale: true } });
    revalidatePath('/admin/settings/poster-identity');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
