import { prisma } from '@noc/db';
import type { BrandTheme } from '@noc/config';

// Reads the admin-editable per-brand theme (Setting `theme.<brand>`); null when unset,
// which makes buildThemeCss() a no-op so the site renders its compiled defaults.
export async function getBrandTheme(brand: 'newobour' | 'alsawarey'): Promise<BrandTheme | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: `theme.${brand}` } });
    if (!row?.value) return null;
    return JSON.parse(row.value) as BrandTheme;
  } catch {
    return null;
  }
}
