import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadRoot } from '../uploads';
import { POSTER_ICONS, type PosterIconKey } from './icons';
export { POSTER_FONTS } from './icons';

// Server-side listing-image renderer in the approved navy/gold/cream identity, Almarai.
// Built as an SVG (frame, corner brackets, header band, tables, seal footer) → sharp → PNG,
// with the maps + the brand logo composited on top (robust; no SVG image-embedding).
// Requires the fonts installed on the host (prod: /usr/share/fonts/ — Almarai/Tajawal/
// Cairo/Changa).
//
// Poster = consolidated Layout A (owner-approved 2026-07-08): header band (Card Title +
// ad pill), big listing location map, then a 2-column grid of the city map + the marked
// group tables (compact, no logo/contacts/ad inside; grid grows past 3 groups), seal
// footer. Unbranded version drops the logo + contacts.
//
// All colors + the font come from a per-brand PosterTheme (admin-editable via the
// Setting `posterTheme.<brand>`); the defaults below are the owner-approved identity.

export type PosterCardGroup = { name: string; icon: PosterIconKey; rows: CardRow[] };
export type PosterData = {
  ad: string; // '#YYMM…' or '' before publish
  title: string; // staff Card Title (upstream falls back to the listing title)
  groups: PosterCardGroup[]; // admin-marked groups (or the first-3 fallback)
  neighborhoodMap: string | null; // public /uploads path (the annotated location map)
  cityMap: string | null; // public /uploads path (city masterplan)
};
export type PosterBrand = 'newobour' | 'alsawarey' | 'unbranded';
export type PosterTheme = { navy: string; gold: string; cream: string; tint: string; ink: string; font: string };
export type BrandCfg = { logoPath: string | null; domain: string; phone: string; theme?: Partial<PosterTheme> };
export type CardRow = { label: string; value: string };
export type CardData = { name: string; icon: PosterIconKey; rows: CardRow[]; title: string; ad: string };
export type AdvGroup = { title: string; items: string[] };

const W = 1080, H = 1350;
export const DEFAULT_POSTER_THEME: PosterTheme = {
  navy: '#0f1f4b',
  gold: '#e7ab16',
  cream: '#fdfaf3',
  tint: '#f6ebd7',
  ink: '#2b3a53',
  font: 'Almarai',
};
const absU = (p: string) => path.join(uploadRoot(), p.replace(/^\/uploads\//, ''));
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Arabic text with leading/trailing digits confuses Pango's base-direction guess
// (e.g. "450 م²" flips to "450²م"; a trailing "15%" jumps across the line — and this
// librsvg ignores RLM/isolate control chars). Fix deterministically: every non-LTR
// <text> gets an explicit direction="rtl" (with its start/end anchor swapped, since
// SVG resolves those against the direction), and percentages render the conventional
// Arabic way: % → ٪ with Arabic-Indic digits (٦٠٪), which needs no bidi joining.
const arNum = (n: string) => n.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]!).replace(/[.,]/g, '٫');
const rtl = (s: string) =>
  String(s).replace(/%/g, '٪').replace(/([0-9]+(?:[.,][0-9]+)?)\s*٪/g, (_, n: string) => `${arNum(n)}٪`);

const clipText = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Naive word-wrap for table values — at most two lines. */
function wrapValue(s: string, max = 30): string[] {
  if (s.length <= max) return [s];
  const words = s.split(' ');
  let l1 = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = l1 ? `${l1} ${words[i]}` : words[i]!;
    if (next.length > max && l1) break;
    l1 = next;
  }
  return [l1, words.slice(i).join(' ')];
}

const resolveTheme = (cfg: BrandCfg): PosterTheme => ({ ...DEFAULT_POSTER_THEME, ...(cfg.theme ?? {}) });

/** SVG building blocks closed over one theme — colors and the font come exclusively
 *  from here so the admin identity settings restyle every generated image. */
function helpers(th: PosterTheme) {
  const T = (x: number, y: number, t: string, o: { s?: number; w?: number; fill?: string; anchor?: string; ltr?: boolean } = {}) => {
    const a = o.anchor ?? 'middle';
    const anchor = o.ltr ? a : a === 'end' ? 'start' : a === 'start' ? 'end' : a;
    return `<text x="${x}" y="${y}" font-family="${th.font}" font-size="${o.s ?? 28}" font-weight="${o.w ?? 400}" fill="${o.fill ?? th.ink}" text-anchor="${anchor}" direction="${o.ltr ? 'ltr' : 'rtl'}">${esc(o.ltr ? t : rtl(t))}</text>`;
  };
  const dvd = (cx: number, y: number, half: number) =>
    `<line x1="${cx - half}" y1="${y}" x2="${cx - 9}" y2="${y}" stroke="${th.gold}" stroke-width="3"/>` +
    `<line x1="${cx + 9}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="${th.gold}" stroke-width="3"/>` +
    `<rect x="${cx - 6}" y="${y - 6}" width="12" height="12" fill="${th.gold}" transform="rotate(45 ${cx} ${y})"/>`;
  // Icon shapes ship with the default gold/navy baked in — recolor for the theme.
  const glyph = (key: PosterIconKey) =>
    POSTER_ICONS[key].split(DEFAULT_POSTER_THEME.gold).join(th.gold).split(DEFAULT_POSTER_THEME.navy).join(th.navy);
  const phoneGlyph = (c: string) =>
    `<path d="M-11,-5 C-11,-8 -8,-11 -5,-11 L-3,-6 C-3,-4 -5,-3 -6,-2 C-5,1 -1,5 2,6 C3,5 4,3 6,3 L11,5 C11,8 8,11 5,11 C-3,10 -10,3 -11,-5 Z" fill="${c}"/>`;

  /** Frame + navy header band (Card Title + ad pill) shared by every image type. */
  const cardChrome = (w: number, h: number, title: string, ad: string) => `<rect width="${w}" height="${h}" fill="${th.cream}"/>
<rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="30" fill="none" stroke="${th.gold}" stroke-width="6"/>
<rect x="4" y="4" width="46" height="46" rx="14" fill="${th.navy}"/><rect x="${w - 50}" y="4" width="46" height="46" rx="14" fill="${th.navy}"/>
<rect x="4" y="${h - 50}" width="46" height="46" rx="14" fill="${th.navy}"/><rect x="${w - 50}" y="${h - 50}" width="46" height="46" rx="14" fill="${th.navy}"/>
<rect x="40" y="44" width="${w - 80}" height="92" rx="20" fill="${th.navy}"/>
${ad ? `<rect x="64" y="66" width="170" height="48" rx="12" fill="none" stroke="${th.gold}" stroke-width="2.5"/>${T(149, 98, ad, { s: 25, w: 700, fill: th.gold, ltr: true })}` : ''}
${T(w - 72, 104, title, { s: 34, w: 800, fill: '#ffffff', anchor: 'end' })}`;

  /** Seal footer: gold hairline + navy strip (phone left, domain right) + center circle
   *  badge painted `circleFill` with a double gold ring and flanking diamonds. */
  const sealFooter = (w: number, fy: number, cfg: BrandCfg, circleFill: string): { svg: string; h: number; logoBox: { top: number; left: number; size: number } } => {
    const stripH = 70, cx = w / 2, cy = fy + 56, r = 66;
    const diamonds = [-1, 1]
      .map((s) => `<rect x="${cx + s * (r + 26) - 7}" y="${cy - 7}" width="14" height="14" fill="${th.gold}" transform="rotate(45 ${cx + s * (r + 26)} ${cy})"/>`)
      .join('');
    const svg =
      `<line x1="40" y1="${fy + 22}" x2="${w - 40}" y2="${fy + 22}" stroke="${th.gold}" stroke-width="3"/>` +
      `<rect x="40" y="${fy + 26}" width="${w - 80}" height="${stripH}" rx="16" fill="${th.navy}"/>` +
      `<g transform="translate(96 ${fy + 26 + stripH / 2})">${phoneGlyph(th.gold)}</g>` +
      T(122, fy + 26 + stripH / 2 + 9, cfg.phone, { s: 26, w: 700, fill: th.gold, ltr: true, anchor: 'start' }) +
      T(w - 96, fy + 26 + stripH / 2 + 9, cfg.domain, { s: 26, w: 700, fill: '#ffffff', ltr: true, anchor: 'end' }) +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${circleFill}" stroke="${th.gold}" stroke-width="5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r - 9}" fill="none" stroke="${th.gold}" stroke-width="1.8" opacity="0.7"/>` +
      diamonds;
    return { svg, h: fy + 26 + stripH + 78, logoBox: { top: cy - 46, left: cx - 46, size: 92 } };
  };

  /** Slim unbranded footer: hairline + empty navy strip (no logo, no contacts). */
  const plainFooter = (w: number, fy: number): { svg: string; h: number } => ({
    svg:
      `<line x1="40" y1="${fy + 22}" x2="${w - 40}" y2="${fy + 22}" stroke="${th.gold}" stroke-width="3"/>` +
      `<rect x="40" y="${fy + 26}" width="${w - 80}" height="34" rx="12" fill="${th.navy}"/>`,
    h: fy + 26 + 34 + 40,
  });

  /** Full-width table row (big cards + advantages). */
  const tableRow = (x: number, y: number, w: number, i: number, rh: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${rh}" rx="14" fill="${i % 2 ? '#ffffff' : th.tint}" stroke="${th.gold}" stroke-width="1" opacity="0.98"/>` +
    `<rect x="${x + w - 26}" y="${y + rh / 2 - 6}" width="12" height="12" fill="${th.gold}" transform="rotate(45 ${x + w - 20} ${y + rh / 2})"/>`;

  /** Compact group table used inside the poster: navy header strip (name + icon) +
   *  up to 5 tight rows — no logo, contacts or ad number. `stretchH` grows the frame
   *  to align with its grid partner. */
  const compactCard = (x: number, y: number, w: number, g: PosterCardGroup, stretchH?: number): { svg: string; h: number } => {
    const headH = 46, rowH = 40;
    const rows = g.rows.slice(0, 5);
    const natural = headH + rows.length * rowH + 10;
    const h = Math.max(natural, stretchH ?? 0);
    const parts: string[] = [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${th.gold}" stroke-width="2"/>`,
      `<path d="M ${x} ${y + 14} a14 14 0 0 1 14 -14 h ${w - 28} a14 14 0 0 1 14 14 v ${headH - 14} h ${-w} Z" fill="${th.navy}"/>`,
      `<circle cx="${x + w - 26}" cy="${y + headH / 2}" r="13" fill="${th.gold}" opacity="0.18"/>`,
      `<g transform="translate(${x + w - 26} ${y + headH / 2}) scale(0.58)">${glyph(g.icon)}</g>`,
      T(x + w - 48, y + headH / 2 + 8, g.name, { s: 22, w: 800, fill: '#ffffff', anchor: 'end' }),
    ];
    rows.forEach((r, i) => {
      const ry = y + headH + i * rowH;
      parts.push(
        `<rect x="${x + 6}" y="${ry + 3}" width="${w - 12}" height="${rowH - 6}" rx="8" fill="${i % 2 ? '#ffffff' : th.tint}"/>`,
        T(x + w - 20, ry + rowH / 2 + 7, r.label, { s: 20, w: 700, fill: th.navy, anchor: 'end' }),
        T(x + 18, ry + rowH / 2 + 7, clipText(r.value, 24), { s: 20, w: 400, fill: th.ink, anchor: 'start' }),
      );
    });
    return { svg: parts.join(''), h };
  };

  return { T, dvd, glyph, cardChrome, sealFooter, plainFooter, tableRow, compactCard };
}

/** Load the brand logo circle-masked (no square corners) + the paint color for the badge:
 *  the logo's own background color when opaque, otherwise the theme navy. */
async function badgeLogo(cfg: BrandCfg, th: PosterTheme): Promise<{ fill: string; logo: Buffer | null }> {
  if (!cfg.logoPath) return { fill: th.navy, logo: null };
  try {
    const size = 92;
    const square = await sharp(await readFile(absU(cfg.logoPath))).resize(size, size, { fit: 'cover' }).png().toBuffer();
    const px = await sharp(square).ensureAlpha().extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
    const fill = (px[3] ?? 0) < 200 ? th.navy : `rgb(${px[0]},${px[1]},${px[2]})`;
    const mask = await sharp(Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)).png().toBuffer();
    const logo = await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    return { fill, logo };
  } catch {
    return { fill: th.navy, logo: null };
  }
}

// ── Per-group card: navy header band + group badge + 5-row table (one attribute per
//    row, label right / value left, long values wrap) + seal footer. Branded only. ──
export async function renderCard(d: CardData, brand: Exclude<PosterBrand, 'unbranded'>, cfg: BrandCfg): Promise<Buffer> {
  const th = resolveTheme(cfg);
  const { T, dvd, glyph, cardChrome, sealFooter, tableRow } = helpers(th);
  const w = W;
  let y = 268;
  const parts: string[] = [];
  for (let i = 0; i < Math.min(d.rows.length, 5); i++) {
    const { label, value } = d.rows[i]!;
    const lines = wrapValue(value);
    const rh = lines.length > 1 ? 104 : 70;
    parts.push(
      tableRow(60, y, w - 120, i, rh),
      T(w - 112, y + (lines.length > 1 ? rh / 2 + 9 : 45), label, { s: 27, w: 700, fill: th.navy, anchor: 'end' }),
    );
    lines.forEach((ln, li) => parts.push(T(w - 470, y + (lines.length > 1 ? 44 + li * 38 : 45), ln, { s: 26, w: 400, anchor: 'end' })));
    y += rh + 12;
  }
  const badge = await badgeLogo(cfg, th);
  const foot = sealFooter(w, y + 14, cfg, badge.fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${foot.h}" viewBox="0 0 ${w} ${foot.h}">
${cardChrome(w, foot.h, d.title, d.ad)}
<circle cx="${w - 92}" cy="196" r="30" fill="${th.navy}"/><g transform="translate(${w - 92} 196) scale(1.1)">${glyph(d.icon)}</g>
${T(w - 140, 208, d.name, { s: 34, w: 800, fill: th.navy, anchor: 'end' })}
${dvd(430, 196, 330)}
${parts.join('')}
${foot.svg}
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!badge.logo) return base;
  return sharp(base).composite([{ input: badge.logo, top: foot.logoBox.top, left: foot.logoBox.left }]).png().toBuffer();
}

// ── Advantages photo: same chrome (Card Title + ad) with one gold level bar per
//    City/District/Neighborhood and its advantages as table rows. Branded only. ──
export async function renderAdvantages(
  groups: AdvGroup[],
  heading: string,
  brand: Exclude<PosterBrand, 'unbranded'>,
  cfg: BrandCfg,
  head?: { title: string; ad: string },
): Promise<Buffer> {
  const th = resolveTheme(cfg);
  const { T, dvd, glyph, cardChrome, sealFooter } = helpers(th);
  const w = W, h = H;
  const usable = groups.filter((g) => g.items.length > 0);
  // Measure, then center the block between the group badge row and the footer.
  const blockH = usable.reduce((a, g) => a + 64 + g.items.length * 64 + 26, 0) - (usable.length ? 26 : 0);
  const top = 240, bottom = h - 190;
  let y = top + Math.max(0, (bottom - top - blockH) / 2);
  const parts: string[] = [];
  for (const g of usable) {
    if (y > bottom - 64) continue;
    parts.push(`<rect x="60" y="${y}" width="${w - 120}" height="54" rx="12" fill="${th.gold}"/>` + T(w - 90, y + 37, g.title, { s: 29, w: 800, fill: th.navy, anchor: 'end' }));
    y += 64;
    let i = 0;
    for (const it of g.items) {
      if (y > bottom - 58) break;
      parts.push(
        `<rect x="60" y="${y}" width="${w - 120}" height="58" fill="${i % 2 ? '#ffffff' : th.tint}" stroke="${th.gold}" stroke-width="1" opacity="0.97"/>`,
        `<rect x="${w - 86}" y="${y + 23}" width="12" height="12" fill="${th.gold}" transform="rotate(45 ${w - 80} ${y + 29})"/>`,
        T(w - 112, y + 39, it.slice(0, 62), { s: 26, w: 500, fill: th.ink, anchor: 'end' }),
      );
      y += 64;
      i++;
    }
    y += 26;
  }
  const badge = await badgeLogo(cfg, th);
  const foot = sealFooter(w, h - 174, cfg, badge.fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${cardChrome(w, h, head?.title ?? heading, head?.ad ?? '')}
<circle cx="${w - 92}" cy="196" r="30" fill="${th.navy}"/><g transform="translate(${w - 92} 196) scale(1.1)">${glyph('star')}</g>
${T(w - 140, 208, heading, { s: 34, w: 800, fill: th.navy, anchor: 'end' })}
${dvd(430, 196, 330)}
${parts.join('')}
${foot.svg}
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!badge.logo) return base;
  return sharp(base).composite([{ input: badge.logo, top: foot.logoBox.top, left: foot.logoBox.left }]).png().toBuffer();
}

/** Render one consolidated poster PNG (Layout A) for a brand. Maps carry no title
 *  pills; the annotation is already part of the location-map image. */
export async function renderPoster(d: PosterData, brand: PosterBrand, cfg: BrandCfg): Promise<Buffer> {
  const th = resolveTheme(cfg);
  const { cardChrome, sealFooter, plainFooter, compactCard } = helpers(th);
  const w = W;
  const branded = brand !== 'unbranded';
  const mapW = w - 80, mapH = 400, colW = (mapW - 18) / 2;
  const parts: string[] = [];
  const mapY = 164;
  let y = mapY;
  if (d.neighborhoodMap) {
    parts.push(`<rect x="40" y="${mapY}" width="${mapW}" height="${mapH}" rx="14" fill="#f2ece0" stroke="${th.gold}" stroke-width="2"/>`);
    y = mapY + mapH + 18;
  }

  // 2-column grid: [group1 | city map] then remaining groups pairwise. The grid grows
  // row by row when more than 3 groups are marked for the poster.
  type Cell = { kind: 'card'; g: PosterCardGroup } | { kind: 'city' };
  const groups = d.groups;
  const cells: Cell[] = [];
  if (groups[0]) cells.push({ kind: 'card', g: groups[0] });
  if (d.cityMap) cells.push({ kind: 'city' });
  for (const g of groups.slice(1)) cells.push({ kind: 'card', g });

  const cardH = (g: PosterCardGroup) => 46 + Math.min(g.rows.length, 5) * 40 + 10;
  let cityBox: { top: number; left: number; w: number; h: number } | null = null;
  for (let i = 0; i < cells.length; i += 2) {
    const row = [cells[i]!, cells[i + 1]].filter(Boolean) as Cell[];
    const rowH = Math.max(...row.map((c) => (c.kind === 'card' ? cardH(c.g) : 0)), 256);
    for (let j = 0; j < row.length; j++) {
      const c = row[j]!;
      const x = j === 0 ? 40 : 40 + colW + 18;
      if (c.kind === 'card') {
        parts.push(compactCard(x, y, colW, c.g, rowH).svg);
      } else {
        parts.push(`<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="14" fill="#eef0f4" stroke="${th.gold}" stroke-width="2"/>`);
        cityBox = { top: y + 4, left: Math.round(x) + 4, w: Math.round(colW) - 8, h: rowH - 8 };
      }
    }
    y += rowH + 14;
  }
  const bottom = y - 14;

  // Footer: branded = seal (badge + contacts); unbranded = slim navy strip only.
  let footSvg = '', h = 0, logoBox: { top: number; left: number } | null = null, badge: { fill: string; logo: Buffer | null } = { fill: th.navy, logo: null };
  if (branded) {
    badge = await badgeLogo(cfg, th);
    const foot = sealFooter(w, bottom + 8, cfg, badge.fill);
    footSvg = foot.svg;
    h = foot.h;
    logoBox = { top: foot.logoBox.top, left: foot.logoBox.left };
  } else {
    const foot = plainFooter(w, bottom + 8);
    footSvg = foot.svg;
    h = foot.h;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${cardChrome(w, h, d.title, d.ad)}
${parts.join('')}
${footSvg}
</svg>`;
  const layers: sharp.OverlayOptions[] = [];
  if (d.neighborhoodMap) {
    try { layers.push({ input: await sharp(absU(d.neighborhoodMap)).resize(mapW - 8, mapH - 8, { fit: 'cover' }).png().toBuffer(), top: mapY + 4, left: 44 }); } catch { /* skip */ }
  }
  if (d.cityMap && cityBox) {
    try { layers.push({ input: await sharp(absU(d.cityMap)).resize(cityBox.w, cityBox.h, { fit: 'cover' }).png().toBuffer(), top: cityBox.top, left: cityBox.left }); } catch { /* skip */ }
  }
  let buf = await sharp(Buffer.from(svg)).png().composite(layers).toBuffer();
  if (branded && badge.logo && logoBox) {
    buf = await sharp(buf).composite([{ input: badge.logo, top: logoBox.top, left: logoBox.left }]).png().toBuffer();
  }
  return buf;
}

/** Persist a PNG buffer under /uploads/<yyyy>/<mm>/<uuid>.png. */
export async function savePng(buf: Buffer): Promise<{ path: string; filename: string; size: number }> {
  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const filename = `${randomUUID()}.png`;
  await mkdir(path.join(uploadRoot(), rel), { recursive: true });
  await writeFile(path.join(uploadRoot(), rel, filename), buf);
  return { path: `/uploads/${rel}/${filename}`, filename, size: buf.length };
}
