// Map stamping: take one clean map image and bake the 'map' category stamp (logo +
// optional footer) into a per-brand copy. Defensive — on any failure / no-op it reuses
// the clean image rather than breaking.
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { uploadRoot } from './uploads';
import { getStampSettings, stampImage, categoryActive, logoForCategory } from './stamp';
import { brandForCategory, getBrandContacts } from './contacts';

type MapCat = 'map' | 'map-newobour';

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
 * Produce a stamped copy of the clean map for ONE site's map category:
 *   'map'          → the Al Sawarey copy (AreaMap.alswareyPath)
 *   'map-newobour' → the New Obour copy (AreaMap.newobourPath)
 * The logo is the config's own uploaded logo (from the watermark page) when set, else that
 * site's brand logo from the Branding page — resolved by logoForCategory. Footer uses that
 * site's brand contacts. If the config is off / has nothing to draw, the clean path is reused.
 */
export async function stampMapCopy(cleanPublicPath: string, cat: MapCat): Promise<string> {
  try {
    const s = await getStampSettings();
    if (!categoryActive(s, cat)) return cleanPublicPath;
    const cfg = s.categories[cat];
    const logo = await logoForCategory(cat, cfg); // custom (watermark page) ?? site brand logo
    const contacts = cfg.footerEnabled ? await getBrandContacts(brandForCategory(cat)) : [];
    const cleanBuf = await readFile(abs(cleanPublicPath));
    const out = await stampImage(cleanBuf, { ...cfg, logoEnabled: cfg.logoEnabled && !!logo }, logo, contacts, cfg.wmLogoPath);
    if (out === cleanBuf || out.equals(cleanBuf)) return cleanPublicPath;
    return await saveBuffer(out);
  } catch (e) {
    console.error('stampMapCopy failed (reusing clean)', e);
    return cleanPublicPath;
  }
}
