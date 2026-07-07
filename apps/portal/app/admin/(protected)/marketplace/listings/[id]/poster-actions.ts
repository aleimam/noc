'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { renderPoster, savePng, type PosterData, type PosterBrand, type PosterGroup } from '../../../../../../lib/poster/render';

type Result = { ok: true } | { ok: false; error: string };
const BRANDS: PosterBrand[] = ['newobour', 'alsawarey', 'unbranded'];
const ICONS: PosterGroup['icon'][] = ['pin', 'bld', 'doc'];

// Turn one stored listing value into a short display string (Arabic — posters are ar-only).
function valStr(v: {
  number: unknown; bool: boolean | null; text: string | null;
  option: { labelAr: string } | null; listItem: { labelAr: string } | null;
  attribute: { labelAr: string; type: string; unit: string | null };
}): string | null {
  if (v.listItem) return v.listItem.labelAr;
  if (v.option) return v.option.labelAr;
  if (v.attribute.type === 'BOOLEAN' || v.attribute.type === 'YESNO') return v.bool ? v.attribute.labelAr : null;
  if (v.number != null) return `${String(v.number)}${v.attribute.unit ? ` ${v.attribute.unit}` : ''}`;
  if (v.text) return v.text.trim() || null;
  return null;
}

async function buildData(listingId: string): Promise<PosterData | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      title: true, adNumber: true, area: true, neighborhoodId: true,
      values: {
        select: {
          number: true, bool: true, text: true,
          option: { select: { labelAr: true } },
          listItem: { select: { labelAr: true } },
          attribute: { select: { labelAr: true, type: true, unit: true, section: { select: { id: true, nameAr: true, order: true } } } },
        },
      },
    },
  });
  if (!l) return null;

  // Group value strings by attribute section (ordered). The FIRST section = Area (shown in
  // the title pill, no card); the next up-to-3 sections become Card 1/2/3.
  const bySec = new Map<string, { name: string; order: number; items: string[] }>();
  for (const v of l.values) {
    const sec = v.attribute.section;
    if (!sec) continue;
    const s = valStr(v);
    if (!s) continue;
    const g = bySec.get(sec.id) ?? { name: sec.nameAr, order: sec.order, items: [] };
    g.items.push(s);
    bySec.set(sec.id, g);
  }
  const ordered = [...bySec.values()].sort((a, b) => a.order - b.order);
  const cardSecs = ordered.slice(1, 4); // skip Area (first), take next 3
  const groups: PosterGroup[] = cardSecs.map((s, i) => {
    const joined = s.items.join(' · ');
    const mid = joined.length > 34 ? joined.lastIndexOf(' · ', Math.ceil(joined.length / 2)) : -1;
    const l1 = mid > 0 ? joined.slice(0, mid) : joined;
    const l2 = mid > 0 ? joined.slice(mid + 3) : '';
    return { name: s.name, l1: l1.slice(0, 46), l2: l2.slice(0, 46), icon: ICONS[i] ?? 'doc' };
  });

  // Maps: the listing's annotated location map + the city masterplan.
  const nbMap = await prisma.areaMap.findFirst({ where: { level: 'listing', areaId: listingId, kind: 'location' }, select: { cleanPath: true } });
  let cityMap: { cleanPath: string } | null = null;
  if (l.neighborhoodId) {
    const nb = await prisma.neighborhood.findUnique({ where: { id: l.neighborhoodId }, select: { district: { select: { cityId: true } } } });
    const cityId = nb?.district?.cityId ?? null;
    if (cityId) cityMap = await prisma.areaMap.findFirst({ where: { level: 'city', areaId: cityId, kind: 'masterplan' }, select: { cleanPath: true } });
  }

  return {
    adNumber: l.adNumber ? `#${l.adNumber}` : '',
    title: l.title,
    areaText: l.area != null ? `المساحة الفعلية · ${String(l.area)} م²` : '',
    groups,
    neighborhoodMap: nbMap?.cleanPath ?? null,
    cityMap: cityMap?.cleanPath ?? null,
  };
}

/** (Re)generate the New Obour / Al Sawarey / unbranded poster variants for a listing. */
export async function generateListingPosters(listingId: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const data = await buildData(listingId);
    if (!data) return { ok: false, error: 'not_found' };
    const s = await prisma.setting.findMany({ where: { key: { in: ['brand_newobour_logo', 'brand_alsawarey_logo', 'alswarey_phone'] } } });
    const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
    const phone = m['alswarey_phone'] || '010 408 10000';
    const cfg = (brand: PosterBrand) =>
      brand === 'alsawarey'
        ? { logoPath: m['brand_alsawarey_logo'] ?? null, domain: 'alsawarey.com', phone }
        : { logoPath: m['brand_newobour_logo'] ?? null, domain: 'newobour.com', phone };

    // Replace any existing generated posters for this listing.
    await prisma.attachment.deleteMany({ where: { ownerType: 'ListingPoster', ownerId: listingId, stampCategory: { startsWith: 'poster:' } } });
    for (const brand of BRANDS) {
      const buf = await renderPoster(data, brand, cfg(brand));
      const saved = await savePng(buf);
      await prisma.attachment.create({
        data: {
          filename: saved.filename,
          originalName: `poster-${brand}.png`,
          path: saved.path,
          mime: 'image/png',
          size: saved.size,
          ownerType: 'ListingPoster',
          ownerId: listingId,
          stampCategory: `poster:${brand}`,
        },
      });
    }
    revalidatePath(`/admin/marketplace/listings/${listingId}/edit`);
    return { ok: true };
  } catch (e) {
    console.error('generateListingPosters failed', e);
    return { ok: false, error: 'failed' };
  }
}

/** List the generated poster variants for a listing (for preview + download). */
export async function listListingPosters(listingId: string): Promise<{ brand: string; path: string }[]> {
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPoster', ownerId: listingId, stampCategory: { startsWith: 'poster:' } },
    select: { path: true, stampCategory: true },
  });
  return rows.map((r) => ({ brand: (r.stampCategory ?? 'poster:').split(':')[1] || '', path: r.path }));
}
