// Map stamping: take one clean map image and bake a brand logo into a copy (one per
// brand). Defensive — on any failure it reuses the clean image rather than breaking.
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { uploadRoot } from './uploads';

function abs(publicPath: string): string {
  return path.join(uploadRoot(), publicPath.replace(/^\/uploads\//, ''));
}

/** Persist a buffer under /uploads/<yyyy>/<mm>/<uuid>.png and return its public path. */
async function saveBuffer(buf: Buffer): Promise<string> {
  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const name = `${randomUUID()}.png`;
  await mkdir(path.join(uploadRoot(), rel), { recursive: true });
  await writeFile(path.join(uploadRoot(), rel, name), buf);
  return `/uploads/${rel}/${name}`;
}

/**
 * Stamp the clean map with the given brand logo (bottom-right, 18% width, 55% opacity)
 * and return the public path of the stamped copy. If no logo is configured, the clean
 * path is reused as-is (no pointless duplicate).
 */
export async function stampMapCopy(cleanPublicPath: string, logoPublicPath: string | null): Promise<string> {
  if (!logoPublicPath) return cleanPublicPath;
  try {
    const sharp = (await import('sharp')).default;
    const cleanBuf = await readFile(abs(cleanPublicPath));
    const base = sharp(cleanBuf);
    const meta = await base.metadata();
    const baseW = meta.width ?? 1200;
    const logoBuf = await readFile(abs(logoPublicPath));
    const targetW = Math.max(48, Math.round(baseW * 0.18));
    const resized = await sharp(logoBuf).resize({ width: targetW }).ensureAlpha().png().toBuffer();
    const a = Math.round(0.55 * 255);
    const faded = await sharp(resized)
      .composite([{ input: Buffer.from([255, 255, 255, a]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
      .png()
      .toBuffer();
    const out = await base.composite([{ input: faded, gravity: 'southeast' }]).png().toBuffer();
    return await saveBuffer(out);
  } catch (e) {
    console.error('stampMapCopy failed (reusing clean)', e);
    return cleanPublicPath;
  }
}
