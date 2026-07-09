// System-wide, fully-reversible photo stamping. Every category (module) has its own
// on/off + format; a global master switch overrides all. Stamps are always derived from
// the pure original, so turning off / changing format / re-stamping never loses data.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { prisma } from '@noc/db';
import { uploadRoot } from './uploads';
import { brandForCategory, getBrandContacts, type BrandContactItem } from './contacts';
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

// ── Footer bar renderers (baked into the image) ─────────────────────────────
const FOOTER_NAVY = '#0b1b33';
const FOOTER_GOLD = '#c9983e';

/** A recognizable gold icon per contact type, centered at (cx,cy) with radius r. */
function contactIcon(type: string, cx: number, cy: number, r: number): string {
  const c = FOOTER_GOLD;
  const sw = Math.max(1.4, r * 0.16);
  switch (type) {
    case 'phone':
      return `<path d="M ${cx - r * 0.5} ${cy - r * 0.7} q -${r * 0.15} ${r * 1.3} ${r * 1.15} ${r * 1.4} l ${r * 0.35} -${r * 0.45} l -${r * 0.55} -${r * 0.3} l -${r * 0.2} ${r * 0.2} q -${r * 0.4} -${r * 0.25} -${r * 0.5} -${r * 0.55} l ${r * 0.2} -${r * 0.2} l -${r * 0.3} -${r * 0.55} Z" fill="${c}"/>`;
    case 'whatsapp':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.95}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${cx - r * 0.35} ${cy - r * 0.45} q -${r * 0.1} ${r * 0.9} ${r * 0.8} ${r * 0.95} l ${r * 0.22} -${r * 0.3} l -${r * 0.38} -${r * 0.2} l -${r * 0.13} ${r * 0.13} q -${r * 0.28} -${r * 0.17} -${r * 0.35} -${r * 0.38} l ${r * 0.13} -${r * 0.13} l -${r * 0.2} -${r * 0.38} Z" fill="${c}"/>`;
    case 'email':
      return `<rect x="${cx - r}" y="${cy - r * 0.7}" width="${r * 2}" height="${r * 1.4}" rx="${r * 0.15}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<path d="M ${cx - r} ${cy - r * 0.6} L ${cx} ${cy + r * 0.15} L ${cx + r} ${cy - r * 0.6}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    case 'website':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.95}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<line x1="${cx - r * 0.95}" y1="${cy}" x2="${cx + r * 0.95}" y2="${cy}" stroke="${c}" stroke-width="${sw * 0.8}"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.45}" ry="${r * 0.95}" fill="none" stroke="${c}" stroke-width="${sw * 0.8}"/>`;
    case 'address':
      return `<path d="M ${cx} ${cy + r} C ${cx - r * 1.1} ${cy - r * 0.2} ${cx - r * 0.7} ${cy - r} ${cx} ${cy - r} C ${cx + r * 0.7} ${cy - r} ${cx + r * 1.1} ${cy - r * 0.2} ${cx} ${cy + r} Z" fill="none" stroke="${c}" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy - r * 0.3}" r="${r * 0.28}" fill="${c}"/>`;
    case 'facebook':
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.3}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<text x="${cx}" y="${cy}" fill="${c}" font-family="Arial,sans-serif" font-weight="bold" font-size="${r * 1.5}" text-anchor="middle" dominant-baseline="central">f</text>`;
    case 'instagram':
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.5}" fill="none" stroke="${c}" stroke-width="${sw}"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="none" stroke="${c}" stroke-width="${sw}"/><circle cx="${cx + r * 0.5}" cy="${cy - r * 0.5}" r="${r * 0.12}" fill="${c}"/>`;
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="${c}"/>`;
  }
}

/** Footer bar built from the brand's managed contacts (icon + value), centered in one row
 *  and shrunk to fit the image width when there are many/long contacts. */
function contactsFooterSvg(W: number, fh: number, contacts: BrandContactItem[]): string {
  const items = contacts.slice(0, 5);
  let fs = Math.round(fh * 0.3);
  let iconR = Math.round(fh * 0.15);
  let gapIT = Math.round(iconR * 0.8);
  let gapItems = Math.round(fh * 0.55);
  const measure = () => {
    const w = items.map((cc) => iconR * 2 + gapIT + Math.ceil(cc.value.length * fs * 0.56));
    return { w, total: w.reduce((a, b) => a + b, 0) + gapItems * Math.max(0, items.length - 1) };
  };
  let { w: widths, total } = measure();
  const availW = W - 32;
  if (total > availW && total > 0) {
    const ratio = availW / total;
    fs = Math.max(11, Math.round(fs * ratio));
    iconR = Math.max(7, Math.round(iconR * ratio));
    gapIT = Math.round(gapIT * ratio);
    gapItems = Math.round(gapItems * ratio);
    ({ w: widths, total } = measure());
  }
  let x = Math.max(12, (W - total) / 2);
  const cy = fh / 2 + 1;
  let out = `<rect width="${W}" height="${fh}" fill="${FOOTER_NAVY}"/><rect width="${W}" height="3" fill="${FOOTER_GOLD}"/>`;
  items.forEach((cc, i) => {
    out += contactIcon(cc.type, x + iconR, cy, iconR);
    out += `<text x="${x + iconR * 2 + gapIT}" y="${cy}" fill="#ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="${fs}" text-anchor="start" dominant-baseline="middle" direction="ltr">${esc(cc.value)}</text>`;
    x += widths[i]! + gapItems;
  });
  return out;
}

/** Legacy free-text footer (fallback when a brand has no managed contacts). */
function legacyFooterSvg(W: number, fh: number, line1: string, line2: string): string {
  const l1 = esc(line1 || ''), l2 = esc(line2 || '');
  const f1 = Math.round(fh * 0.36), f2 = Math.round(fh * 0.28), y1 = l2 ? fh * 0.42 : fh * 0.6;
  return `<rect width="${W}" height="${fh}" fill="${FOOTER_NAVY}"/><rect width="${W}" height="3" fill="${FOOTER_GOLD}"/>` +
    (l1 ? `<text x="${W / 2}" y="${y1}" fill="#ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="${f1}" text-anchor="middle" dominant-baseline="middle">${l1}</text>` : '') +
    (l2 ? `<text x="${W / 2}" y="${fh * 0.78}" fill="#cdd6e4" font-family="Arial,sans-serif" font-size="${f2}" text-anchor="middle" dominant-baseline="middle">${l2}</text>` : '');
}

/** Bake the configured logo + footer into an image buffer. The footer prefers the brand's
 *  managed `contacts` (icon + value), falling back to the free-text lines. No-op safe. */
export async function stampImage(buffer: Buffer, cfg: StampConfig, logoPath: string | null, contacts: BrandContactItem[] = []): Promise<Buffer> {
  const wantsLogo = cfg.logoEnabled && !!logoPath;
  const wantsFooter = cfg.footerEnabled && (contacts.length > 0 || !!(cfg.footerLine1 || cfg.footerLine2));
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
      const inner = contacts.length > 0 ? contactsFooterSvg(W, fh, contacts) : legacyFooterSvg(W, fh, cfg.footerLine1, cfg.footerLine2);
      const svg = `<svg width="${W}" height="${fh}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
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

/** Stamp a pure buffer for a category if that category is active; else return it unchanged.
 *  The footer bar uses the category's brand contacts (listing/map → Al Sawarey, else New Obour). */
export async function stampForCategory(buffer: Buffer, cat: StampCategory): Promise<Buffer> {
  const s = await getStampSettings();
  if (!categoryActive(s, cat)) return buffer;
  const cfg = s.categories[cat];
  const logo = await logoForCategory(cat, cfg);
  const contacts = cfg.footerEnabled ? await getBrandContacts(brandForCategory(cat)) : [];
  return stampImage(buffer, cfg, logo, contacts);
}
