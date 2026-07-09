// New Obour service/module visibility, toggled from the backend. Al Sawarey is fixed
// (always shows its catalogue/sell/contact) — this is portal-only.
import { prisma } from '@noc/db';

// Nav keys must match the public-nav keys in PublicShell's NAV. `partnerships` is a
// feature flag (not a nav item): when off, the plot-consolidation/partnership UI is hidden
// everywhere (market filter/badge/section, account opt-in, and the listing form).
export const MODULE_KEYS = ['market', 'explore', 'rationing', 'calculator', 'news', 'guide', 'priceIndex', 'partnerships'] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  market: 'السوق',
  explore: 'استكشاف الأحياء',
  rationing: 'كشوف التقنين',
  calculator: 'الحاسبات',
  news: 'الأخبار',
  guide: 'دليل البناء',
  priceIndex: 'مؤشر الأسعار',
  partnerships: 'تجميع الملاك والشراكات',
};

/** Is the partnerships feature enabled? (default on) */
export async function partnershipsEnabled(): Promise<boolean> {
  return (await getModuleVisibility()).partnerships !== false;
}

const KEY = 'newobour.modules';

export async function getModuleVisibility(): Promise<Record<ModuleKey, boolean>> {
  const def = Object.fromEntries(MODULE_KEYS.map((k) => [k, true])) as Record<ModuleKey, boolean>;
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return def;
    return { ...def, ...(JSON.parse(row.value) as Partial<Record<ModuleKey, boolean>>) };
  } catch {
    return def;
  }
}

export async function saveModuleVisibility(map: Record<string, boolean>): Promise<void> {
  const clean = Object.fromEntries(MODULE_KEYS.map((k) => [k, map[k] !== false]));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(clean) }, create: { key: KEY, value: JSON.stringify(clean) } });
}

/** Keys that are turned OFF (hidden from the public nav). */
export async function hiddenModuleKeys(): Promise<string[]> {
  const vis = await getModuleVisibility();
  return MODULE_KEYS.filter((k) => vis[k] === false);
}
