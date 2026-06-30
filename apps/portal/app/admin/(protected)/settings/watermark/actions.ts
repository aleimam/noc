'use server';

import { revalidatePath } from 'next/cache';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../../../lib/uploads';
import { applyWatermark, getWatermarkConfig, saveWatermarkConfig, type WatermarkConfig } from '../../../../../lib/watermark';

export async function saveWatermark(cfg: Partial<WatermarkConfig>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await saveWatermarkConfig(cfg);
    revalidatePath('/admin/settings/watermark');
    return { ok: true };
  } catch (e) {
    console.error('saveWatermark failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Re-stamp every brokerage land photo in place with the current watermark. Run on request. */
export async function restampLandPhotos(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('marketplace', 'UPDATE');
  const cfg = await getWatermarkConfig();
  if (!cfg.enabled || !cfg.logoPath) return { ok: false, error: 'disabled' };
  try {
    // photos attached to listings shown on the brokerage storefront
    const listingIds = (await prisma.listing.findMany({ where: { showOnBrokerage: true }, select: { id: true } })).map((l) => l.id);
    if (!listingIds.length) return { ok: true, count: 0 };
    const photos = await prisma.attachment.findMany({
      where: { ownerType: 'Listing', ownerId: { in: listingIds } },
      select: { id: true, path: true },
    });
    let count = 0;
    for (const p of photos) {
      try {
        const file = path.join(uploadRoot(), p.path.replace(/^\/uploads\//, ''));
        const buf = await readFile(file);
        const out = await applyWatermark(buf, cfg);
        if (out !== buf) {
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
    console.error('restampLandPhotos failed', e);
    return { ok: false, error: 'failed' };
  }
}
