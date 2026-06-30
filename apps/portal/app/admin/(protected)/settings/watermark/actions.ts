'use server';

import { revalidatePath } from 'next/cache';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../../../lib/uploads';
import { getStampSettings, saveStampSettings, stampImage, logoForCategory, type StampSettings } from '../../../../../lib/stamp';
import { stampMapCopy } from '../../../../../lib/mapStamp';

type Result = { ok: true } | { ok: false; error: string };

export async function saveStamp(s: StampSettings): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await saveStampSettings(s);
    revalidatePath('/admin/settings/watermark');
    return { ok: true };
  } catch (e) {
    console.error('saveStamp failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Re-stamp ALSWARY listing photos in place. Note: stamps bake into the file, so run
 *  once after configuring — repeated runs stack the stamp. */
export async function restampListingPhotos(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  const cfg = (await getStampSettings()).listing;
  const logo = await logoForCategory('listing', cfg);
  if ((!cfg.logoEnabled || !logo) && !cfg.footerEnabled) return { ok: false, error: 'disabled' };
  try {
    const listingIds = (await prisma.listing.findMany({ where: { showOnBrokerage: true }, select: { id: true } })).map((l) => l.id);
    if (!listingIds.length) return { ok: true, count: 0 };
    const photos = await prisma.attachment.findMany({ where: { ownerType: 'Listing', ownerId: { in: listingIds } }, select: { id: true, path: true } });
    let count = 0;
    for (const p of photos) {
      try {
        const file = path.join(uploadRoot(), p.path.replace(/^\/uploads\//, ''));
        const buf = await readFile(file);
        const out = await stampImage(buf, cfg, logo);
        if (!out.equals(buf)) {
          await writeFile(file, out);
          await prisma.attachment.update({ where: { id: p.id }, data: { size: out.length } });
          count++;
        }
      } catch {
        /* skip a bad file */
      }
    }
    return { ok: true, count };
  } catch (e) {
    console.error('restampListingPhotos failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Re-generate every area map's brand copies from the CLEAN originals (safe to re-run). */
export async function restampMaps(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const logos = await prisma.setting.findMany({ where: { key: { in: ['brand_alsawarey_logo', 'brand_newobour_logo'] } } });
    const lm = Object.fromEntries(logos.map((s) => [s.key, s.value]));
    const maps = await prisma.areaMap.findMany();
    let count = 0;
    for (const m of maps) {
      const [alswareyPath, newobourPath] = await Promise.all([
        stampMapCopy(m.cleanPath, lm['brand_alsawarey_logo'] ?? null),
        stampMapCopy(m.cleanPath, lm['brand_newobour_logo'] ?? null),
      ]);
      await prisma.areaMap.update({ where: { id: m.id }, data: { alswareyPath, newobourPath } });
      count++;
    }
    return { ok: true, count };
  } catch (e) {
    console.error('restampMaps failed', e);
    return { ok: false, error: 'failed' };
  }
}
