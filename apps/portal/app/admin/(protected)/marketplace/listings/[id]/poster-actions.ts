'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@noc/auth';
import { prisma } from '@noc/db';
import {
  renderPoster, renderCard, renderAdvantages, savePng,
  type PosterData, type PosterBrand, type PosterGroup, type CardData, type AdvGroup,
} from '../../../../../../lib/poster/render';
import { advantagesForNeighborhood } from '../../../../../../lib/advantages';

type Result = { ok: true } | { ok: false; error: string };
const POSTER_BRANDS: PosterBrand[] = ['newobour', 'alsawarey', 'unbranded'];
const CARD_BRANDS = ['newobour', 'alsawarey'] as const;
const ICONS: PosterGroup['icon'][] = ['pin', 'bld', 'doc'];

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

// Pack short value strings into up to `maxLines` lines of ~maxLen chars.
function toLines(items: string[], maxLen = 40, maxLines = 3): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const it of items) {
    const next = cur ? `${cur} · ${it}` : it;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = it;
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    } else cur = next;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

type Gathered = { poster: PosterData; cards: CardData[]; advantages: AdvGroup[] };

async function gather(listingId: string): Promise<Gathered | null> {
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

  // Group value strings by section (ordered). First section = Area (title pill only).
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
  const nonArea = ordered.slice(1); // drop the Area group (first)
  const areaShort = l.area != null ? `${String(l.area)} م²` : '';

  const cards: CardData[] = nonArea.map((s, i) => ({ name: s.name, lines: toLines(s.items), icon: ICONS[i % ICONS.length]!, areaShort }));

  // Maps: annotated listing location + city masterplan.
  const nbMap = await prisma.areaMap.findFirst({ where: { level: 'listing', areaId: listingId, kind: 'location' }, select: { cleanPath: true } });
  let cityMap: { cleanPath: string } | null = null;
  if (l.neighborhoodId) {
    const nb = await prisma.neighborhood.findUnique({ where: { id: l.neighborhoodId }, select: { district: { select: { cityId: true } } } });
    const cityId = nb?.district?.cityId ?? null;
    if (cityId) cityMap = await prisma.areaMap.findFirst({ where: { level: 'city', areaId: cityId, kind: 'masterplan' }, select: { cleanPath: true } });
  }

  const poster: PosterData = {
    adNumber: l.adNumber ? `#${l.adNumber}` : '',
    title: l.title,
    areaText: l.area != null ? `المساحة الفعلية · ${String(l.area)} م²` : '',
    groups: cards.slice(0, 3).map((c) => ({ name: c.name, l1: c.lines[0] ?? '', l2: c.lines[1] ?? '', icon: c.icon })),
    neighborhoodMap: nbMap?.cleanPath ?? null,
    cityMap: cityMap?.cleanPath ?? null,
  };

  const advantages = await advantagesForNeighborhood(l.neighborhoodId, 'ar');
  return { poster, cards, advantages };
}

/** (Re)generate the full image set for a listing: poster ×3 brands, one card per non-Area
 *  group ×2 brands, and the advantages photo ×2 brands. Stored as Attachment rows. */
export async function generateListingPosters(listingId: string): Promise<Result> {
  await requirePermission('marketplace', 'UPDATE');
  try {
    const g = await gather(listingId);
    if (!g) return { ok: false, error: 'not_found' };
    const s = await prisma.setting.findMany({ where: { key: { in: ['brand_newobour_logo', 'brand_alsawarey_logo', 'alswarey_phone'] } } });
    const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
    const phone = m['alswarey_phone'] || '010 408 10000';
    const cfg = (brand: PosterBrand) =>
      brand === 'alsawarey'
        ? { logoPath: m['brand_alsawarey_logo'] ?? null, domain: 'alsawarey.com', phone }
        : { logoPath: m['brand_newobour_logo'] ?? null, domain: 'newobour.com', phone };

    const save = async (buf: Buffer, cat: string, name: string) => {
      const f = await savePng(buf);
      await prisma.attachment.create({ data: { filename: f.filename, originalName: name, path: f.path, mime: 'image/png', size: f.size, ownerType: 'ListingPoster', ownerId: listingId, stampCategory: cat } });
    };

    await prisma.attachment.deleteMany({ where: { ownerType: 'ListingPoster', ownerId: listingId } });

    for (const brand of POSTER_BRANDS) await save(await renderPoster(g.poster, brand, cfg(brand)), `poster:${brand}`, `poster-${brand}.png`);
    for (const brand of CARD_BRANDS) {
      for (let i = 0; i < g.cards.length; i++) await save(await renderCard(g.cards[i]!, brand, cfg(brand)), `card:${brand}:${i}`, `card-${i}-${brand}.png`);
      if (g.advantages.length) await save(await renderAdvantages(g.advantages, 'مميزات المنطقة', brand, cfg(brand)), `adv:${brand}`, `advantages-${brand}.png`);
    }

    revalidatePath(`/admin/marketplace/listings/${listingId}/edit`);
    return { ok: true };
  } catch (e) {
    console.error('generateListingPosters failed', e);
    return { ok: false, error: 'failed' };
  }
}

export type GenImage = { kind: 'poster' | 'card' | 'adv'; brand: string; path: string };

/** List all generated images for a listing (poster / card / advantages), for preview + download. */
export async function listListingPosters(listingId: string): Promise<GenImage[]> {
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPoster', ownerId: listingId },
    select: { path: true, stampCategory: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => {
    const [kind, brand] = (r.stampCategory ?? '').split(':');
    return { kind: (kind === 'card' ? 'card' : kind === 'adv' ? 'adv' : 'poster'), brand: brand || '', path: r.path };
  });
}
