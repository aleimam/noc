// ALSWARY land-photo watermark (baked into the file via sharp). Ships DORMANT:
// enabled=false by default, so nothing is stamped until staff configure + enable it.
// Every path is defensive — on any failure it returns the original bytes untouched
// so uploads never break.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { prisma } from '@noc/db';
import { uploadRoot } from './uploads';

export type WatermarkConfig = {
  enabled: boolean;
  logoPath: string | null; // /uploads/... of the stamp
  position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0..1
  scale: number; // logo width as % of the photo width (1..50)
};

export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  logoPath: null,
  position: 'bottom-right',
  opacity: 0.5,
  scale: 18,
};

const KEY = 'alsawarey.watermark';

export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_WATERMARK;
    return { ...DEFAULT_WATERMARK, ...(JSON.parse(row.value) as Partial<WatermarkConfig>) };
  } catch {
    return DEFAULT_WATERMARK;
  }
}

export async function saveWatermarkConfig(cfg: Partial<WatermarkConfig>): Promise<void> {
  const merged = { ...(await getWatermarkConfig()), ...cfg };
  await prisma.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(merged) }, create: { key: KEY, value: JSON.stringify(merged) } });
}

const GRAVITY: Record<WatermarkConfig['position'], string> = {
  'top-left': 'northwest',
  'top-right': 'northeast',
  center: 'center',
  'bottom-left': 'southwest',
  'bottom-right': 'southeast',
};

/** Resolve a public /uploads/... path to its absolute file path. */
function abs(publicPath: string): string {
  return path.join(uploadRoot(), publicPath.replace(/^\/uploads\//, ''));
}

/**
 * Bake the configured watermark into an image buffer. Returns the original buffer when
 * disabled, unconfigured, or on any error. `cfg` may be passed to avoid a re-read.
 */
export async function applyWatermark(buffer: Buffer, cfg?: WatermarkConfig): Promise<Buffer> {
  const wm = cfg ?? (await getWatermarkConfig());
  if (!wm.enabled || !wm.logoPath) return buffer;
  try {
    const sharp = (await import('sharp')).default;
    const base = sharp(buffer);
    const meta = await base.metadata();
    const baseW = meta.width ?? 1000;
    const logoBuf = await readFile(abs(wm.logoPath));
    const targetW = Math.max(32, Math.round((baseW * Math.min(50, Math.max(1, wm.scale))) / 100));
    // resize logo, then knock its alpha down to the configured opacity
    const resized = await sharp(logoBuf).resize({ width: targetW }).ensureAlpha().png().toBuffer();
    const a = Math.round(Math.min(1, Math.max(0, wm.opacity)) * 255);
    const faded = await sharp(resized)
      .composite([{ input: Buffer.from([255, 255, 255, a]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
      .png()
      .toBuffer();
    return await base.composite([{ input: faded, gravity: GRAVITY[wm.position] as never }]).toBuffer();
  } catch (e) {
    console.error('applyWatermark failed (returning original)', e);
    return buffer;
  }
}
