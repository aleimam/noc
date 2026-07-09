'use server';

import { revalidatePath } from 'next/cache';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../../../lib/uploads';
import {
  getStampSettings,
  saveStampSettings,
  stampImage,
  logoForCategory,
  categoryActive,
  restampListingPhotos,
  BAKED_CATEGORIES,
  type StampSettings,
  type StampCategory,
} from '../../../../../lib/stamp';
import { getBrandContacts, brandForCategory } from '../../../../../lib/contacts';
import { stampMapCopy } from '../../../../../lib/mapStamp';

type Result = { ok: true } | { ok: false; error: string };
type CountResult = { ok: true; count: number } | { ok: false; error: string };

function abs(publicPath: string): string {
  return path.join(uploadRoot(), publicPath.replace(/^\/uploads\//, ''));
}

/** Persist a buffer under /uploads/<yyyy>/<mm>/<uuid><ext> and return its public path. */
async function saveBuffer(buf: Buffer, ext: string): Promise<string> {
  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const name = `${randomUUID()}.${ext}`;
  await mkdir(path.join(uploadRoot(), rel), { recursive: true });
  await writeFile(path.join(uploadRoot(), rel, name), buf);
  return `/uploads/${rel}/${name}`;
}

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

/**
 * Re-stamp every photo of a baked category FROM ITS PURE ORIGINAL (never from the current
 * rendition — so this is idempotent and never stacks). If the category isn't actively
 * stamping, each photo's current rendition is reset back to its pure original.
 */
export async function restampCategory(cat: StampCategory): Promise<CountResult> {
  await requirePermission('marketplace', 'UPDATE');
  if (cat === 'map') return restampMaps();
  // Listing photos re-stamp PER LISTING so each picks up its category's (Type) rule.
  if (cat === 'listing') {
    try {
      const rows = await prisma.attachment.findMany({
        where: { ownerType: 'Listing', stampCategory: 'listing', originalPath: { not: null } },
        select: { ownerId: true },
        distinct: ['ownerId'],
      });
      let count = 0;
      for (const r of rows) {
        if (!r.ownerId) continue;
        try { count += await restampListingPhotos(r.ownerId); } catch { /* skip */ }
      }
      return { ok: true, count };
    } catch (e) {
      console.error('restamp listings failed', e);
      return { ok: false, error: 'failed' };
    }
  }
  if (!BAKED_CATEGORIES.includes(cat)) return { ok: false, error: 'not_bakeable' };
  try {
    const s = await getStampSettings();
    const active = categoryActive(s, cat);
    const cfg = s.categories[cat];
    const logo = active ? await logoForCategory(cat, cfg) : null;
    const contacts = active && cfg.footerEnabled ? await getBrandContacts(brandForCategory(cat)) : [];
    const rows = await prisma.attachment.findMany({
      where: { stampCategory: cat, originalPath: { not: null } },
      select: { id: true, originalPath: true },
    });
    let count = 0;
    for (const r of rows) {
      if (!r.originalPath) continue;
      try {
        const origBuf = await readFile(abs(r.originalPath));
        if (active) {
          const out = await stampImage(origBuf, cfg, logo, contacts);
          if (!out.equals(origBuf)) {
            const ext = r.originalPath.split('.').pop() || 'jpg';
            const newPath = await saveBuffer(out, ext);
            await prisma.attachment.update({ where: { id: r.id }, data: { path: newPath, size: out.length } });
          } else {
            await prisma.attachment.update({ where: { id: r.id }, data: { path: r.originalPath, size: origBuf.length } });
          }
        } else {
          // Stamping off for this category → show the pure original.
          await prisma.attachment.update({ where: { id: r.id }, data: { path: r.originalPath, size: origBuf.length } });
        }
        count++;
      } catch {
        /* skip a bad file */
      }
    }
    return { ok: true, count };
  } catch (e) {
    console.error('restampCategory failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Revert a category's photos to their pure originals (no stamp), leaving config untouched. */
export async function revertCategory(cat: StampCategory): Promise<CountResult> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    if (cat === 'map') {
      const maps = await prisma.areaMap.findMany();
      for (const m of maps) {
        await prisma.areaMap.update({ where: { id: m.id }, data: { alswareyPath: m.cleanPath, newobourPath: m.cleanPath } });
      }
      return { ok: true, count: maps.length };
    }
    const rows = await prisma.attachment.findMany({
      where: { stampCategory: cat, originalPath: { not: null } },
      select: { id: true, originalPath: true },
    });
    let count = 0;
    for (const r of rows) {
      if (!r.originalPath) continue;
      await prisma.attachment.update({ where: { id: r.id }, data: { path: r.originalPath } });
      count++;
    }
    return { ok: true, count };
  } catch (e) {
    console.error('revertCategory failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** Re-generate every area map's brand copies from the CLEAN originals (safe to re-run). */
export async function restampMaps(): Promise<CountResult> {
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

// ── Brand contacts (feed the photo-stamp footer bar) ─────────────────────────
export type ContactInput = { id?: string; brand: string; type: string; value: string; isActive?: boolean };

export async function saveBrandContact(input: ContactInput): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  const brand = input.brand === 'alsawarey' ? 'alsawarey' : 'newobour';
  const value = (input.value ?? '').trim().slice(0, 190);
  if (!value) return { ok: false, error: 'empty' };
  try {
    if (input.id) {
      await prisma.brandContact.update({ where: { id: input.id }, data: { brand, type: input.type, value, isActive: input.isActive ?? true } });
    } else {
      const max = await prisma.brandContact.aggregate({ where: { brand }, _max: { order: true } });
      await prisma.brandContact.create({ data: { brand, type: input.type, value, order: (max._max.order ?? 0) + 1, isActive: input.isActive ?? true } });
    }
    revalidatePath('/admin/settings/watermark');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteBrandContact(id: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    await prisma.brandContact.delete({ where: { id } });
    revalidatePath('/admin/settings/watermark');
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
