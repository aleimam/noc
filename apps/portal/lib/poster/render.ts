import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadRoot } from '../uploads';
import { POSTER_ICONS, type PosterIconKey } from './icons';

// Server-side listing-image renderer in the approved navy/gold/cream identity, Almarai.
// Built as an SVG (frame, corner brackets, header band, tables, seal footer) → sharp → PNG,
// with the maps + the brand logo composited on top (robust; no SVG image-embedding).
// Requires the Almarai + Tajawal fonts installed on the host (prod: /usr/share/fonts/).
//
// Poster = consolidated Layout A (owner-approved 2026-07-08): header band (Card Title +
// ad pill), big listing location map, then a 2×2 grid of the city map + the first 3
// group tables (compact, no logo/contacts/ad inside), seal footer. Unbranded version
// drops the logo + contacts.

export type PosterCardGroup = { name: string; icon: PosterIconKey; rows: CardRow[] };
export type PosterData = {
  ad: string; // '#YYMM…' or '' before publish
  title: string; // staff Card Title (upstream falls back to the listing title)
  groups: PosterCardGroup[]; // first 3 non-Area groups
  neighborhoodMap: string | null; // public /uploads path (the annotated location map)
  cityMap: string | null; // public /uploads path (city masterplan)
};
export type PosterBrand = 'newobour' | 'alsawarey' | 'unbranded';
export type BrandCfg = { logoPath: string | null; domain: string; phone: string };

const W = 1080, H = 1350;
const NAVY = '#0f1f4b', GOLD = '#e7ab16', GOLD2 = '#c9983e', CREAM = '#fdfaf3', INK = '#2b3a53', TINT = '#f6ebd7';
// Cards + advantages photo use Almarai (owner-approved 2026-07-08); the poster keeps Tajawal.
const CARD_FONT = 'Almarai';
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
const T = (x: number, y: number, t: string, o: { s?: number; w?: number; fill?: string; anchor?: string; ltr?: boolean; font?: string } = {}) => {
  const a = o.anchor ?? 'middle';
  const anchor = o.ltr ? a : a === 'end' ? 'start' : a === 'start' ? 'end' : a;
  return `<text x="${x}" y="${y}" font-family="${o.font ?? 'Tajawal'}" font-size="${o.s ?? 28}" font-weight="${o.w ?? 400}" fill="${o.fill ?? INK}" text-anchor="${anchor}" direction="${o.ltr ? 'ltr' : 'rtl'}">${esc(o.ltr ? t : rtl(t))}</text>`;
};
const dvd = (cx: number, y: number, half: number) =>
  `<line x1="${cx - half}" y1="${y}" x2="${cx - 9}" y2="${y}" stroke="${GOLD}" stroke-width="3"/>` +
  `<line x1="${cx + 9}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="${GOLD}" stroke-width="3"/>` +
  `<rect x="${cx - 6}" y="${y - 6}" width="12" height="12" fill="${GOLD}" transform="rotate(45 ${cx} ${y})"/>`;
// Icon shapes live in ./icons (shared with the admin picker); GLYPH keeps the old name.
const GLYPH = POSTER_ICONS;

const clipText = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Compact group table used inside the poster: navy header strip (name + icon) +
 *  up to 5 tight rows — no logo, contacts or ad number. `stretchH` grows the frame
 *  to align with its grid partner. */
function compactCard(x: number, y: number, w: number, g: PosterCardGroup, stretchH?: number): { svg: string; h: number } {
  const headH = 46, rowH = 40;
  const rows = g.rows.slice(0, 5);
  const natural = headH + rows.length * rowH + 10;
  const h = Math.max(natural, stretchH ?? 0);
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${GOLD}" stroke-width="2"/>`,
    `<path d="M ${x} ${y + 14} a14 14 0 0 1 14 -14 h ${w - 28} a14 14 0 0 1 14 14 v ${headH - 14} h ${-w} Z" fill="${NAVY}"/>`,
    `<circle cx="${x + w - 26}" cy="${y + headH / 2}" r="13" fill="${GOLD}" opacity="0.18"/>`,
    `<g transform="translate(${x + w - 26} ${y + headH / 2}) scale(0.58)">${GLYPH[g.icon]}</g>`,
    T(x + w - 48, y + headH / 2 + 8, g.name, { s: 22, w: 800, fill: '#ffffff', anchor: 'end', font: CARD_FONT }),
  ];
  rows.forEach((r, i) => {
    const ry = y + headH + i * rowH;
    parts.push(
      `<rect x="${x + 6}" y="${ry + 3}" width="${w - 12}" height="${rowH - 6}" rx="8" fill="${i % 2 ? '#ffffff' : TINT}"/>`,
      T(x + w - 20, ry + rowH / 2 + 7, r.label, { s: 20, w: 700, fill: NAVY, anchor: 'end', font: CARD_FONT }),
      T(x + 18, ry + rowH / 2 + 7, clipText(r.value, 24), { s: 20, w: 400, fill: INK, anchor: 'start', font: CARD_FONT }),
    );
  });
  return { svg: parts.join(''), h };
}

/** Render one consolidated poster PNG (Layout A) for a brand. Maps carry no title
 *  pills (owner request); the annotation is already part of the location-map image. */
export async function renderPoster(d: PosterData, brand: PosterBrand, cfg: BrandCfg): Promise<Buffer> {
  const w = W;
  const branded = brand !== 'unbranded';
  const mapW = w - 80, mapH = 400, colW = (mapW - 18) / 2;
  const parts: string[] = [];
  const mapY = 164;
  let y = mapY;
  if (d.neighborhoodMap) {
    parts.push(`<rect x="40" y="${mapY}" width="${mapW}" height="${mapH}" rx="14" fill="#f2ece0" stroke="${GOLD}" stroke-width="2"/>`);
    y = mapY + mapH + 18;
  }

  // 2-column grid: [group1 | city map] then remaining groups pairwise.
  type Cell = { kind: 'card'; g: PosterCardGroup } | { kind: 'city' };
  const groups = d.groups.slice(0, 3);
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
        parts.push(`<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="14" fill="#eef0f4" stroke="${GOLD}" stroke-width="2"/>`);
        cityBox = { top: y + 4, left: Math.round(x) + 4, w: Math.round(colW) - 8, h: rowH - 8 };
      }
    }
    y += rowH + 14;
  }
  const bottom = y - 14;

  // Footer: branded = seal (badge + contacts); unbranded = slim navy strip only.
  let footSvg = '', h = 0, logoBox: { top: number; left: number } | null = null, badge: { fill: string; logo: Buffer | null } = { fill: NAVY, logo: null };
  if (branded) {
    badge = await badgeLogo(cfg);
    const foot = sealFooter(w, bottom + 8, cfg, badge.fill);
    footSvg = foot.svg;
    h = foot.h;
    logoBox = { top: foot.logoBox.top, left: foot.logoBox.left };
  } else {
    const fy = bottom + 8;
    footSvg = `<line x1="40" y1="${fy + 22}" x2="${w - 40}" y2="${fy + 22}" stroke="${GOLD}" stroke-width="3"/>` +
      `<rect x="40" y="${fy + 26}" width="${w - 80}" height="34" rx="12" fill="${NAVY}"/>`;
    h = fy + 26 + 34 + 40;
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

const brackets = (w: number, h: number) =>
  `<rect x="2" y="2" width="42" height="42" rx="13" fill="${NAVY}"/><rect x="${w - 44}" y="2" width="42" height="42" rx="13" fill="${NAVY}"/>` +
  `<rect x="2" y="${h - 44}" width="42" height="42" rx="13" fill="${NAVY}"/><rect x="${w - 44}" y="${h - 44}" width="42" height="42" rx="13" fill="${NAVY}"/>`;

// ═══ S1 card system (owner-approved 2026-07-08): Almarai, navy header band with the
//     staff Card Title + ad pill, 5-row attribute table, seal footer with the brand
//     logo in a painted circle (double gold ring + flanking diamonds). ═══

const phoneGlyph = (c: string) =>
  `<path d="M-11,-5 C-11,-8 -8,-11 -5,-11 L-3,-6 C-3,-4 -5,-3 -6,-2 C-5,1 -1,5 2,6 C3,5 4,3 6,3 L11,5 C11,8 8,11 5,11 C-3,10 -10,3 -11,-5 Z" fill="${c}"/>`;

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

/** Frame + navy header band (Card Title + ad pill) shared by cards and the advantages photo. */
function cardChrome(w: number, h: number, title: string, ad: string): string {
  return `<rect width="${w}" height="${h}" fill="${CREAM}"/>
<rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="30" fill="none" stroke="${GOLD}" stroke-width="6"/>
<rect x="4" y="4" width="46" height="46" rx="14" fill="${NAVY}"/><rect x="${w - 50}" y="4" width="46" height="46" rx="14" fill="${NAVY}"/>
<rect x="4" y="${h - 50}" width="46" height="46" rx="14" fill="${NAVY}"/><rect x="${w - 50}" y="${h - 50}" width="46" height="46" rx="14" fill="${NAVY}"/>
<rect x="40" y="44" width="${w - 80}" height="92" rx="20" fill="${NAVY}"/>
${ad ? `<rect x="64" y="66" width="170" height="48" rx="12" fill="none" stroke="${GOLD}" stroke-width="2.5"/>${T(149, 98, ad, { s: 25, w: 700, fill: GOLD, ltr: true, font: CARD_FONT })}` : ''}
${T(w - 72, 104, title, { s: 34, w: 800, fill: '#ffffff', anchor: 'end', font: CARD_FONT })}`;
}

/** Seal footer: gold hairline + navy strip (phone left, domain right) + center circle badge
 *  painted `circleFill` with a double gold ring and flanking diamonds. Returns where the
 *  circle-masked logo must be composited. */
function sealFooter(w: number, fy: number, cfg: BrandCfg, circleFill: string): { svg: string; h: number; logoBox: { top: number; left: number; size: number } } {
  const stripH = 70, cx = w / 2, cy = fy + 56, r = 66;
  const diamonds = [-1, 1]
    .map((s) => `<rect x="${cx + s * (r + 26) - 7}" y="${cy - 7}" width="14" height="14" fill="${GOLD}" transform="rotate(45 ${cx + s * (r + 26)} ${cy})"/>`)
    .join('');
  const svg =
    `<line x1="40" y1="${fy + 22}" x2="${w - 40}" y2="${fy + 22}" stroke="${GOLD}" stroke-width="3"/>` +
    `<rect x="40" y="${fy + 26}" width="${w - 80}" height="${stripH}" rx="16" fill="${NAVY}"/>` +
    `<g transform="translate(96 ${fy + 26 + stripH / 2})">${phoneGlyph(GOLD)}</g>` +
    T(122, fy + 26 + stripH / 2 + 9, cfg.phone, { s: 26, w: 700, fill: GOLD, ltr: true, anchor: 'start', font: CARD_FONT }) +
    T(w - 96, fy + 26 + stripH / 2 + 9, cfg.domain, { s: 26, w: 700, fill: '#ffffff', ltr: true, anchor: 'end', font: CARD_FONT }) +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${circleFill}" stroke="${GOLD}" stroke-width="5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - 9}" fill="none" stroke="${GOLD}" stroke-width="1.8" opacity="0.7"/>` +
    diamonds;
  return { svg, h: fy + 26 + stripH + 78, logoBox: { top: cy - 46, left: cx - 46, size: 92 } };
}

/** Load the brand logo circle-masked (no square corners) + the paint color for the badge:
 *  the logo's own background color when opaque, otherwise navy. */
async function badgeLogo(cfg: BrandCfg): Promise<{ fill: string; logo: Buffer | null }> {
  if (!cfg.logoPath) return { fill: NAVY, logo: null };
  try {
    const size = 92;
    const square = await sharp(await readFile(absU(cfg.logoPath))).resize(size, size, { fit: 'cover' }).png().toBuffer();
    const px = await sharp(square).ensureAlpha().extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
    const fill = (px[3] ?? 0) < 200 ? NAVY : `rgb(${px[0]},${px[1]},${px[2]})`;
    const mask = await sharp(Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)).png().toBuffer();
    const logo = await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    return { fill, logo };
  } catch {
    return { fill: NAVY, logo: null };
  }
}

// ── Per-group card: navy header band + group badge + 5-row table (one attribute per
//    row, label right / value left, long values wrap) + seal footer. Branded only. ──
export type CardRow = { label: string; value: string };
export type CardData = { name: string; icon: PosterIconKey; rows: CardRow[]; title: string; ad: string };

export async function renderCard(d: CardData, brand: Exclude<PosterBrand, 'unbranded'>, cfg: BrandCfg): Promise<Buffer> {
  const w = W;
  let y = 268;
  const parts: string[] = [];
  for (let i = 0; i < Math.min(d.rows.length, 5); i++) {
    const { label, value } = d.rows[i]!;
    const lines = wrapValue(value);
    const rh = lines.length > 1 ? 104 : 70;
    parts.push(
      `<rect x="60" y="${y}" width="${w - 120}" height="${rh}" rx="14" fill="${i % 2 ? '#ffffff' : TINT}" stroke="${GOLD}" stroke-width="1" opacity="0.98"/>`,
      `<rect x="${w - 86}" y="${y + rh / 2 - 6}" width="12" height="12" fill="${GOLD}" transform="rotate(45 ${w - 80} ${y + rh / 2})"/>`,
      T(w - 112, y + (lines.length > 1 ? rh / 2 + 9 : 45), label, { s: 27, w: 700, fill: NAVY, anchor: 'end', font: CARD_FONT }),
    );
    lines.forEach((ln, li) => parts.push(T(w - 470, y + (lines.length > 1 ? 44 + li * 38 : 45), ln, { s: 26, w: 400, anchor: 'end', font: CARD_FONT })));
    y += rh + 12;
  }
  const badge = await badgeLogo(cfg);
  const foot = sealFooter(w, y + 14, cfg, badge.fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${foot.h}" viewBox="0 0 ${w} ${foot.h}">
${cardChrome(w, foot.h, d.title, d.ad)}
<circle cx="${w - 92}" cy="196" r="30" fill="${NAVY}"/><g transform="translate(${w - 92} 196) scale(1.1)">${GLYPH[d.icon]}</g>
${T(w - 140, 208, d.name, { s: 34, w: 800, fill: NAVY, anchor: 'end', font: CARD_FONT })}
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
export type AdvGroup = { title: string; items: string[] };

export async function renderAdvantages(
  groups: AdvGroup[],
  heading: string,
  brand: Exclude<PosterBrand, 'unbranded'>,
  cfg: BrandCfg,
  head?: { title: string; ad: string },
): Promise<Buffer> {
  const w = W, h = H;
  const usable = groups.filter((g) => g.items.length > 0);
  // Measure, then center the block between the group badge row and the footer.
  const blockH = usable.reduce((a, g) => a + 64 + g.items.length * 64 + 26, 0) - (usable.length ? 26 : 0);
  const top = 240, bottom = h - 190;
  let y = top + Math.max(0, (bottom - top - blockH) / 2);
  const parts: string[] = [];
  for (const g of usable) {
    if (y > bottom - 64) continue;
    parts.push(`<rect x="60" y="${y}" width="${w - 120}" height="54" rx="12" fill="${GOLD}"/>` + T(w - 90, y + 37, g.title, { s: 29, w: 800, fill: NAVY, anchor: 'end', font: CARD_FONT }));
    y += 64;
    let i = 0;
    for (const it of g.items) {
      if (y > bottom - 58) break;
      parts.push(
        `<rect x="60" y="${y}" width="${w - 120}" height="58" fill="${i % 2 ? '#ffffff' : TINT}" stroke="${GOLD}" stroke-width="1" opacity="0.97"/>`,
        `<rect x="${w - 86}" y="${y + 23}" width="12" height="12" fill="${GOLD}" transform="rotate(45 ${w - 80} ${y + 29})"/>`,
        T(w - 112, y + 39, it.slice(0, 62), { s: 26, w: 500, fill: INK, anchor: 'end', font: CARD_FONT }),
      );
      y += 64;
      i++;
    }
    y += 26;
  }
  const badge = await badgeLogo(cfg);
  const foot = sealFooter(w, h - 174, cfg, badge.fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${cardChrome(w, h, head?.title ?? heading, head?.ad ?? '')}
<circle cx="${w - 92}" cy="196" r="30" fill="${NAVY}"/><g transform="translate(${w - 92} 196) scale(1.1)">${GLYPH.star}</g>
${T(w - 140, 208, heading, { s: 34, w: 800, fill: NAVY, anchor: 'end', font: CARD_FONT })}
${dvd(430, 196, 330)}
${parts.join('')}
${foot.svg}
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!badge.logo) return base;
  return sharp(base).composite([{ input: badge.logo, top: foot.logoBox.top, left: foot.logoBox.left }]).png().toBuffer();
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
