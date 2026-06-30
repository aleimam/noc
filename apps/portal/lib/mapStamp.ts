// Map stamping: take one clean map image and bake the 'map' category stamp (logo +
// optional footer) into a per-brand copy. Defensive — on any failure / no-op it reuses
// the clean image rather than breaking.
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { uploadRoot } from './uploads';
import { getStampSettings, stampImage } from './stamp';

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
 * Produce a stamped copy of the clean map for a given brand logo, using the admin's
 * 'map' stamp config (logo position/opacity/size + optional footer). If the config
 * produces no change (logo+footer both off, or no logo), the clean path is reused.
 */
export async function stampMapCopy(cleanPublicPath: string, logoPublicPath: string | null): Promise<string> {
  try {
    const cfg = (await getStampSettings()).map;
    const cleanBuf = await readFile(abs(cleanPublicPath));
    const out = await stampImage(cleanBuf, { ...cfg, logoEnabled: cfg.logoEnabled && !!logoPublicPath }, logoPublicPath);
    if (out === cleanBuf || out.equals(cleanBuf)) return cleanPublicPath;
    return await saveBuffer(out);
  } catch (e) {
    console.error('stampMapCopy failed (reusing clean)', e);
    return cleanPublicPath;
  }
}
