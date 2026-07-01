// System-wide, fully-reversible photo stamping. Every category (module) has its own
// on/off + format; a global master switch overrides all. Stamps are always derived from
// the pure original, so turning off / changing format / re-stamping never loses data.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { prisma } from '@noc/db';
import { uploadRoot } from './uploads';
import {
  STAMP_CATEGORIES,
  BAKED_CATEGORIES,
  DEFAULT_CONFIG,
  DEFAULT_SETTINGS,
  type StampPosition,
  type StampConfig,
  type StampCategory,
  type StampSettings,
} from './stampTypes';

// Re-export the client-safe types/constants so existing importers of '@/lib/stamp' keep working.
export { STAMP_CATEGORIES, BAKED_CATEGORIES, DEFAULT_SETTINGS };
export type { StampPosition, StampConfig, StampCategory, StampSettings };

const KEY = 'stamp.config';

export async function getStampSettings(): Promise<StampSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_SETTINGS;
    const p = JSON.parse(row.value) as Partial<StampSettings>;
    const categories = Object.fromEntries(
      STAMP_CATEGORIES.map((c) => [c, { ...DEFAULT_CONFIG, ...(p.categories?.[c] ?? {}) }]),
    ) as Record<StampCategory, StampConfig>;
    return { global: !!p.global, categories };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStampSettings(s: StampSettings): Promise<void> {
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(s) }, create: { key: KEY, value: JSON.stringify(s) } });
}

/** Is this category actually stamping right now (master on + category on + something to draw)? */
export function categoryActive(s: StampSettings, cat: StampCategory): boolean {
  const c = s.categories[cat];
  return s.global && !!c?.enabled && (c.logoEnabled || c.footerEnabled);
}

const GRAVITY: Record<StampPosition, string> = {
  'top-left': 'northwest',
  'top-right': 'northeast',
  center: 'center',
  'bottom-left': 'southwest',
  'bottom-right': 'southeast',
};

function abs(p: string): string {
  return path.join(uploadRoot(), p.replace(/^\/uploads\//, ''));
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Bake the configured logo + footer into an image buffer. Returns original on no-op/failure. */
export async function stampImage(buffer: Buffer, cfg: StampConfig, logoPath: string | null): Promise<Buffer> {
  const wantsLogo = cfg.logoEnabled && !!logoPath;
  const wantsFooter = cfg.footerEnabled && !!(cfg.footerLine1 || cfg.footerLine2);
  if (!wantsLogo && !wantsFooter) return buffer;
  try {
    const sharp = (await import('sharp')).default;
    const base = sharp(buffer);
    const meta = await base.metadata();
    const W = meta.width ?? 1200;
    const H = meta.height ?? 800;
    const composites: { input: Buffer; gravity?: string; top?: number; left?: number }[] = [];

    if (wantsLogo && logoPath) {
      const logoBuf = await readFile(abs(logoPath));
      const targetW = Math.max(32, Math.round((W * Math.min(50, Math.max(1, cfg.scale))) / 100));
      const resized = await sharp(logoBuf).resize({ width: targetW }).ensureAlpha().png().toBuffer();
      const a = Math.round(Math.min(1, Math.max(0, cfg.opacity)) * 255);
      const faded = await sharp(resized)
        .composite([{ input: Buffer.from([255, 255, 255, a]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
        .png()
        .toBuffer();
      composites.push({ input: faded, gravity: GRAVITY[cfg.position] });
    }
    if (wantsFooter) {
      const fh = Math.max(46, Math.round(W * 0.08));
      const l1 = esc(cfg.footerLine1 || '');
      const l2 = esc(cfg.footerLine2 || '');
      const f1 = Math.round(fh * 0.36);
      const f2 = Math.round(fh * 0.28);
      const y1 = l2 ? fh * 0.42 : fh * 0.6;
      const svg =
        `<svg width="${W}" height="${fh}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="${W}" height="${fh}" fill="#0b1b33"/><rect width="${W}" height="3" fill="#c9983e"/>` +
        (l1 ? `<text x="${W / 2}" y="${y1}" fill="#ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="${f1}" text-anchor="middle" dominant-baseline="middle">${l1}</text>` : '') +
        (l2 ? `<text x="${W / 2}" y="${fh * 0.78}" fill="#cdd6e4" font-family="Arial,sans-serif" font-size="${f2}" text-anchor="middle" dominant-baseline="middle">${l2}</text>` : '') +
        `</svg>`;
      composites.push({ input: Buffer.from(svg), top: Math.max(0, H - fh), left: 0 });
    }
    if (!composites.length) return buffer;
    return await base.composite(composites as never).toBuffer();
  } catch (e) {
    console.error('stampImage failed (returning original)', e);
    return buffer;
  }
}

/** Resolve the logo for a category: explicit override, else the relevant brand logo. */
export async function logoForCategory(cat: StampCategory, cfg: StampConfig): Promise<string | null> {
  if (cfg.logoPath) return cfg.logoPath;
  const brandKey = cat === 'listing' || cat === 'map' ? 'brand_alsawarey_logo' : 'brand_newobour_logo';
  const row = await prisma.setting.findUnique({ where: { key: brandKey } });
  return row?.value ?? null;
}

/**
 * Bridge the unified 'rationing-scan' category to the live scan-viewer overlay. The scan
 * viewer stamps on display (never bakes), so it just needs {enabled, logoPath, position,
 * opacity, scale}. Returns null when this category isn't actively stamping — the caller
 * then falls back to the legacy rationing watermark config.
 */
export async function rationingScanOverlay(): Promise<{ enabled: boolean; logoPath: string; position: StampPosition; opacity: number; scale: number } | null> {
  const s = await getStampSettings();
  if (!categoryActive(s, 'rationing-scan')) return null;
  const cfg = s.categories['rationing-scan'];
  if (!cfg.logoEnabled) return null;
  const logoPath = await logoForCategory('rationing-scan', cfg);
  if (!logoPath) return null;
  return { enabled: true, logoPath, position: cfg.position, opacity: cfg.opacity, scale: cfg.scale };
}

/** Stamp a pure buffer for a category if that category is active; else return it unchanged. */
export async function stampForCategory(buffer: Buffer, cat: StampCategory): Promise<Buffer> {
  const s = await getStampSettings();
  if (!categoryActive(s, cat)) return buffer;
  const cfg = s.categories[cat];
  const logo = await logoForCategory(cat, cfg);
  return stampImage(buffer, cfg, logo);
}
