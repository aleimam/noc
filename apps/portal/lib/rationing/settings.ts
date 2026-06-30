// Admin-editable configuration for the rationing module (Level A).
// Stored as a single JSON blob in Setting('rationing.config'); merged over defaults
// so missing keys always fall back. Texts live in i18n; this holds toggles, the
// city-independent appearance knobs, and any admin text overrides.
import { prisma } from '@noc/db';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type Watermark = {
  enabled: boolean;
  logoPath: string | null; // /uploads/... of the stamp logo
  position: WatermarkPosition;
  opacity: number; // 0..1
  scale: number; // width as % of the scan (1..50)
};

export type RationingConfig = {
  didYouMeanEnabled: boolean; // global "did you mean?" toggle
  showSourceSheets: boolean; // show scanned-page viewer (phase 2)
  showDashboard: boolean; // public dashboard section (phase 4)
  showBrowseAll: boolean; // allow viewing all rows without searching
  accentColor: string; // hero/accent override (hex)
  watermark: Watermark;
  // optional text overrides keyed by locale; null/absent → use i18n default
  text?: Partial<Record<'ar' | 'en', Partial<{ heroTitle: string; heroSubtitle: string }>>>;
};

export const DEFAULT_CONFIG: RationingConfig = {
  didYouMeanEnabled: true,
  showSourceSheets: true,
  showDashboard: true,
  showBrowseAll: true,
  accentColor: '#c9983e',
  watermark: { enabled: true, logoPath: null, position: 'bottom-right', opacity: 0.5, scale: 18 },
};

const KEY = 'rationing.config';

export async function getRationingConfig(): Promise<RationingConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_CONFIG;
    const parsed = JSON.parse(row.value) as Partial<RationingConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, watermark: { ...DEFAULT_CONFIG.watermark, ...(parsed.watermark ?? {}) } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveRationingConfig(cfg: Partial<RationingConfig>): Promise<void> {
  const current = await getRationingConfig();
  const merged = { ...current, ...cfg };
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: KEY, value: JSON.stringify(merged) },
  });
}
