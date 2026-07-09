// Plain server helpers (NOT a server action) for generating a listing's image set. Kept
// permission-free here so trusted server code (e.g. the publish flow) can call it; the
// client-callable, permission-checked wrappers live in the listing's poster-actions.ts.
import { prisma } from '@noc/db';
import { formatDetailValue, type DetailConfig } from '@noc/config';
import {
  renderPoster, renderCard, renderAdvantages, savePng,
  type PosterData, type PosterBrand, type CardData, type AdvGroup,
} from './render';
import { advantagesForNeighborhood } from '../advantages';
import { getStandardAreas } from '../marketplace';
import { isPosterIcon, type PosterIconKey } from './icons';

const POSTER_BRANDS: PosterBrand[] = ['newobour', 'alsawarey', 'unbranded'];
const CARD_BRANDS = ['newobour', 'alsawarey'] as const;
const ICONS: PosterIconKey[] = ['pin', 'bld', 'doc']; // fallback cycle when no admin-assigned icon

export type GenImage = { kind: 'poster' | 'card' | 'adv'; brand: string; path: string };

type ValueCtx = { geoName: Map<string, string>; standardAreas: number[] };

function fmtMonthYear(s: string): string {
  const [y, m] = s.split('-').map(Number);
  if (!y || !m) return s;
  try {
    return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  } catch {
    return s;
  }
}

// Format a stored value for the generated images, mirroring the public detail page so the
// images match the site: option/list labels, DISTRICT/NEIGHBORHOOD ids resolved to their
// Arabic names, month/year dates, and the shared MONEY/AREA/NUMBER/YESNO formatter (with
// units). An absent plain yes/no is hidden so the sheet stays a positive marketing card.
function valStr(
  v: {
    number: unknown; bool: boolean | null; text: string | null;
    option: { labelAr: string } | null; listItem: { labelAr: string } | null;
    attribute: { labelAr: string; type: string; unit: string | null; config: unknown };
  },
  ctx: ValueCtx,
): string | null {
  if (v.listItem) return v.listItem.labelAr;
  if (v.option) return v.option.labelAr;
  const { type, unit, config } = v.attribute;
  if ((type === 'DISTRICT' || type === 'NEIGHBORHOOD') && v.text) return ctx.geoName.get(v.text) ?? null;
  if (type === 'DATE' && v.text) return fmtMonthYear(v.text);
  if (type === 'BOOLEAN' && !v.bool) return null;
  return formatDetailValue({
    type,
    unit,
    number: v.number != null ? Number(v.number) : null,
    bool: v.bool,
    text: v.text,
    config: (config as DetailConfig | null) ?? null,
    locale: 'ar',
    standardAreas: ctx.standardAreas,
  });
}

type Gathered = { poster: PosterData; cards: CardData[]; advantages: AdvGroup[]; headTitle: string; headAd: string };

async function gather(listingId: string): Promise<Gathered | null> {
  const l = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      title: true, cardTitle: true, adNumber: true, area: true, neighborhoodId: true, typeOptionId: true,
      values: {
        select: {
          number: true, bool: true, text: true,
          option: { select: { labelAr: true } },
          listItem: { select: { labelAr: true } },
          attribute: { select: { labelAr: true, type: true, unit: true, config: true, section: { select: { id: true, nameAr: true, order: true, icon: true } } } },
        },
      },
    },
  });
  if (!l) return null;

  // Resolve DISTRICT/NEIGHBORHOOD attribute values (each stores a geo id in `text`) to
  // Arabic names, and load the standard-area list, so valStr matches the public page.
  const standardAreas = await getStandardAreas();
  const geoIds = l.values
    .filter((v) => (v.attribute.type === 'DISTRICT' || v.attribute.type === 'NEIGHBORHOOD') && v.text)
    .map((v) => v.text as string);
  const geoName = new Map<string, string>();
  if (geoIds.length) {
    const [ds, ns] = await Promise.all([
      prisma.district.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true } }),
      prisma.neighborhood.findMany({ where: { id: { in: geoIds } }, select: { id: true, nameAr: true } }),
    ]);
    for (const g of [...ds, ...ns]) geoName.set(g.id, g.nameAr);
  }
  const ctx: ValueCtx = { geoName, standardAreas };

  // Rows keep label + value (one attribute = one table row); PHOTOS/DOCUMENTS carry
  // file markers, not display values, so they never appear on cards.
  const bySec = new Map<string, { id: string; name: string; order: number; icon: string | null; rows: { label: string; value: string }[] }>();
  for (const v of l.values) {
    const sec = v.attribute.section;
    if (!sec || v.attribute.type === 'PHOTOS' || v.attribute.type === 'DOCUMENTS') continue;
    const s = valStr(v, ctx);
    if (!s) continue;
    const g = bySec.get(sec.id) ?? { id: sec.id, name: sec.nameAr, order: sec.order, icon: sec.icon, rows: [] };
    // MULTI_SELECT stores one row per choice — merge repeats into one table row.
    const prev = g.rows.find((r) => r.label === v.attribute.labelAr);
    if (prev) prev.value = `${prev.value} · ${s}`;
    else g.rows.push({ label: v.attribute.labelAr, value: s });
    bySec.set(sec.id, g);
  }
  const ordered = [...bySec.values()].sort((a, b) => a.order - b.order);
  const nonArea = ordered.slice(1); // drop Area (first section)
  const headTitle = l.cardTitle?.trim() || l.title; // staff Card Title, falling back to the listing title
  const headAd = l.adNumber ? `#${l.adNumber}` : '';

  // Per-category render marks (Type option × group): a makeCard=false row hides that
  // group's small card (default = shown); onPoster rows define the poster set — when
  // the option has none, the first 3 groups appear (legacy fallback).
  const renderMarks = l.typeOptionId
    ? await prisma.categorySectionRender.findMany({ where: { optionId: l.typeOptionId }, select: { sectionId: true, makeCard: true, onPoster: true } })
    : [];
  const cardOff = new Set(renderMarks.filter((m) => !m.makeCard).map((m) => m.sectionId));
  const posterOn = new Set(renderMarks.filter((m) => m.onPoster).map((m) => m.sectionId));

  // Admin-assigned icon on the section wins; otherwise fall back to the fixed cycle.
  const toCard = (s: (typeof nonArea)[number], i: number): CardData => ({
    name: s.name,
    rows: s.rows.slice(0, 5),
    icon: isPosterIcon(s.icon) ? s.icon : ICONS[i % ICONS.length]!,
    title: headTitle,
    ad: headAd,
  });
  const cards: CardData[] = nonArea.filter((s) => !cardOff.has(s.id)).map(toCard);
  // The Area group (first section) is special by owner decision: it ALWAYS opens the
  // poster INSIDE THE TITLE BAR (never as a card) — its first two attributes become a
  // "label: value · label: value" strip. Its marks are not configurable.
  const areaGroup = ordered[0];
  const areaStrip = areaGroup && areaGroup.rows.length
    ? areaGroup.rows.slice(0, 2).map((r) => `${r.label}: ${r.value}`).join('   ·   ')
    : null;
  const posterCards: CardData[] = (posterOn.size ? nonArea.filter((s) => posterOn.has(s.id)) : nonArea.slice(0, 3)).map(toCard);

  const nbMap = await prisma.areaMap.findFirst({ where: { level: 'listing', areaId: listingId, kind: 'location' }, select: { cleanPath: true } });
  let cityMap: { cleanPath: string } | null = null;
  if (l.neighborhoodId) {
    const nb = await prisma.neighborhood.findUnique({ where: { id: l.neighborhoodId }, select: { district: { select: { cityId: true } } } });
    const cityId = nb?.district?.cityId ?? null;
    if (cityId) cityMap = await prisma.areaMap.findFirst({ where: { level: 'city', areaId: cityId, kind: 'masterplan' }, select: { cleanPath: true } });
  }

  const poster: PosterData = {
    ad: headAd,
    title: headTitle,
    areas: areaStrip,
    // Consolidated Layout A: admin-marked groups (or the first-3 fallback), Area excluded
    // (it lives in the title bar); the grid grows row by row when more than 3 are marked.
    groups: posterCards.map((c) => ({ name: c.name, icon: c.icon, rows: c.rows })),
    neighborhoodMap: nbMap?.cleanPath ?? null,
    cityMap: cityMap?.cleanPath ?? null,
  };
  const advantages = await advantagesForNeighborhood(l.neighborhoodId, 'ar');
  return { poster, cards, advantages, headTitle, headAd };
}

/** (Re)generate the full image set for a listing. Throws on failure. No permission check. */
export async function regenerateListingImages(listingId: string): Promise<void> {
  const g = await gather(listingId);
  if (!g) return;
  const s = await prisma.setting.findMany({
    where: { key: { in: ['brand_newobour_logo', 'brand_alsawarey_logo', 'alswarey_phone', 'posterTheme.newobour', 'posterTheme.alsawarey'] } },
  });
  const m = Object.fromEntries(s.map((x) => [x.key, x.value]));
  const phone = m['alswarey_phone'] || '010 408 10000';
  // Admin poster identity (Setting posterTheme.<brand>): colors/font + optional
  // logo/phone/domain overrides — separate from the websites' theming.
  const themeOf = (key: string): Record<string, string> => {
    try { return JSON.parse(m[key] ?? '') as Record<string, string>; } catch { return {}; }
  };
  const cfg = (brand: PosterBrand) => {
    const base =
      brand === 'alsawarey'
        ? { logoPath: m['brand_alsawarey_logo'] ?? null, domain: 'alsawarey.com', phone }
        : { logoPath: m['brand_newobour_logo'] ?? null, domain: 'newobour.com', phone };
    const t = themeOf(brand === 'alsawarey' ? 'posterTheme.alsawarey' : 'posterTheme.newobour');
    const pick = (k: string) => (typeof t[k] === 'string' && t[k] ? t[k] : undefined);
    return {
      logoPath: pick('logoPath') ?? base.logoPath,
      domain: pick('domain') ?? base.domain,
      phone: pick('phone') ?? base.phone,
      theme: {
        ...(pick('navy') ? { navy: t.navy } : {}),
        ...(pick('gold') ? { gold: t.gold } : {}),
        ...(pick('cream') ? { cream: t.cream } : {}),
        ...(pick('tint') ? { tint: t.tint } : {}),
        ...(pick('ink') ? { ink: t.ink } : {}),
        ...(pick('font') ? { font: t.font } : {}),
      },
    };
  };

  const save = async (buf: Buffer, cat: string, name: string) => {
    const f = await savePng(buf);
    await prisma.attachment.create({ data: { filename: f.filename, originalName: name, path: f.path, mime: 'image/png', size: f.size, ownerType: 'ListingPoster', ownerId: listingId, stampCategory: cat } });
  };

  await prisma.attachment.deleteMany({ where: { ownerType: 'ListingPoster', ownerId: listingId } });
  for (const brand of POSTER_BRANDS) await save(await renderPoster(g.poster, brand, cfg(brand)), `poster:${brand}`, `poster-${brand}.png`);
  for (const brand of CARD_BRANDS) {
    for (let i = 0; i < g.cards.length; i++) await save(await renderCard(g.cards[i]!, brand, cfg(brand)), `card:${brand}:${i}`, `card-${i}-${brand}.png`);
    if (g.advantages.length) await save(await renderAdvantages(g.advantages, 'مميزات المنطقة', brand, cfg(brand), { title: g.headTitle, ad: g.headAd }), `adv:${brand}`, `advantages-${brand}.png`);
  }
  await prisma.listing.update({ where: { id: listingId }, data: { postersStale: false } });
}

/** Flag every listing under an area (city/district/neighborhood) as having stale images —
 *  called when that area's advantages change (advantages feed the poster + advantages photo). */
export async function markAreaListingsStale(level: 'city' | 'district' | 'neighborhood', areaId: string): Promise<void> {
  const where =
    level === 'city' ? { neighborhood: { district: { cityId: areaId } } }
      : level === 'district' ? { neighborhood: { districtId: areaId } }
        : { neighborhoodId: areaId };
  await prisma.listing.updateMany({ where, data: { postersStale: true } });
}

/** All generated images for a listing (poster / card / advantages). Optionally one brand. */
export async function listListingImages(listingId: string, brand?: string): Promise<GenImage[]> {
  const rows = await prisma.attachment.findMany({
    where: { ownerType: 'ListingPoster', ownerId: listingId, ...(brand ? { stampCategory: { contains: brand } } : {}) },
    select: { path: true, stampCategory: true },
    orderBy: { stampCategory: 'asc' },
  });
  return rows.map((r) => {
    const [kind, b] = (r.stampCategory ?? '').split(':');
    return { kind: kind === 'card' ? 'card' : kind === 'adv' ? 'adv' : 'poster', brand: b || '', path: r.path };
  });
}
