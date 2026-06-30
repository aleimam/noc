// Per-category photo stamping: a configurable logo watermark (position / opacity / size)
// plus an optional contact footer bar, baked into the image via sharp. Each photo
// category (listing photos, maps) has its own format. Admin-editable; defensive — any
// failure returns the original bytes so uploads never break.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { prisma } from '@noc/db';
import { uploadRoot } from './uploads';

export type StampPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

export type StampConfig = {
  logoEnabled: boolean;
  logoPath: string | null; // optional override stamp; falls back to the category's brand logo
  position: StampPosition;
  opacity: number; // 0..1
  scale: number; // logo width as % of the photo width
  footerEnabled: boolean;
  footerLine1: string; // e.g. "01040810000 · WhatsApp"
  footerLine2: string; // e.g. "alsawarey.com"
};

export type StampCategory = 'listing' | 'map';
export const STAMP_CATEGORIES: StampCategory[] = ['listing', 'map'];
export type StampSettings = Record<StampCategory, StampConfig>;

export const DEFAULT_CONFIG: StampConfig = {
  logoEnabled: false,
  logoPath: null,
  position: 'bottom-right',
  opacity: 0.55,
  scale: 18,
  footerEnabled: false,
  footerLine1: '',
  footerLine2: '',
};
export const DEFAULT_SETTINGS: StampSettings = { listing: { ...DEFAULT_CONFIG }, map: { ...DEFAULT_CONFIG } };

const KEY = 'stamp.config';

export async function getStampSettings(): Promise<StampSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_SETTINGS;
    const p = JSON.parse(row.value) as Partial<Record<StampCategory, Partial<StampConfig>>>;
    return {
      listing: { ...DEFAULT_CONFIG, ...(p.listing ?? {}) },
      map: { ...DEFAULT_CONFIG, ...(p.map ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStampSettings(s: StampSettings): Promise<void> {
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(s) }, create: { key: KEY, value: JSON.stringify(s) } });
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
export async function logoForCategory(category: StampCategory, cfg: StampConfig): Promise<string | null> {
  if (cfg.logoPath) return cfg.logoPath;
  const brandKey = category === 'listing' ? 'brand_alsawarey_logo' : 'brand_newobour_logo';
  const row = await prisma.setting.findUnique({ where: { key: brandKey } });
  return row?.value ?? null;
}

/** Stamp a buffer using a category's config (resolving its logo). */
export async function stampForCategory(buffer: Buffer, category: StampCategory): Promise<Buffer> {
  const cfg = (await getStampSettings())[category];
  const logo = await logoForCategory(category, cfg);
  return stampImage(buffer, cfg, logo);
}
