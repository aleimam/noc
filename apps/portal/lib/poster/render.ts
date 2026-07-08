import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadRoot } from '../uploads';
import { POSTER_ICONS, type PosterIconKey } from './icons';

// Server-side listing-poster renderer (Layout A) in the approved navy/gold/cream identity.
// Built as an SVG (frame, corner brackets, gold divider, cards, footer) → sharp → PNG, with
// the two maps + the brand logo composited on top (robust; no SVG image-embedding). Requires
// the Tajawal font installed on the host (prod: /usr/share/fonts/tajawal).

export type PosterGroup = { name: string; l1: string; l2: string; icon: PosterIconKey };
export type PosterData = {
  adNumber: string;
  title: string;
  areaText: string; // e.g. "المساحة الفعلية · 450 م²"
  groups: PosterGroup[]; // up to 3 (the main non-Area groups)
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

function cardSvg(x: number, y: number, w: number, h: number, g: PosterGroup) {
  const cx = x + w / 2, icx = x + w - 58, icy = y + 52;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#ffffff" stroke="${GOLD}" stroke-width="3"/>` +
    `<circle cx="${icx}" cy="${icy}" r="30" fill="${NAVY}"/><g transform="translate(${icx} ${icy})">${GLYPH[g.icon]}</g>` +
    T(x + w - 104, y + 63, g.name, { s: 34, w: 800, fill: NAVY, anchor: 'end' }) +
    dvd(cx, y + 100, w / 2 - 40) +
    T(cx, y + 152, g.l1, { s: 25, w: 500, fill: INK }) +
    T(cx, y + 192, g.l2, { s: 25, w: 500, fill: INK })
  );
}
const mapFrame = (x: number, y: number, w: number, h: number, lbl: string, lblRight: boolean) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#f2ece0" stroke="${GOLD}" stroke-width="3"/>` +
  `<rect x="${lblRight ? x + w - 246 : x + 12}" y="${y + 14}" width="234" height="40" rx="10" fill="${NAVY}"/>` +
  T(lblRight ? x + w - 129 : x + 129, y + 42, lbl, { s: 22, w: 700, fill: '#fff' });

function baseSvg(d: PosterData, brand: PosterBrand, cfg: BrandCfg): string {
  const cards = d.groups.slice(0, 3);
  const cellPos = [[550, 672], [40, 962], [550, 962]] as const; // Card1 (top-right), Card2, Card3
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${CREAM}"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="${GOLD}" stroke-width="6"/>
<rect x="4" y="4" width="46" height="46" rx="14" fill="${NAVY}"/><rect x="${W - 50}" y="4" width="46" height="46" rx="14" fill="${NAVY}"/>
<rect x="4" y="${H - 50}" width="46" height="46" rx="14" fill="${NAVY}"/><rect x="${W - 50}" y="${H - 50}" width="46" height="46" rx="14" fill="${NAVY}"/>
<rect x="40" y="70" width="185" height="58" rx="13" fill="${NAVY}"/>${d.adNumber ? T(132, 108, d.adNumber, { s: 27, w: 700, fill: '#fff', ltr: true }) : ''}
<rect x="245" y="52" width="600" height="126" rx="16" fill="#ffffff" stroke="${GOLD}" stroke-width="3"/>
${T(545, 100, d.title, { s: 38, w: 800, fill: NAVY })}
<rect x="330" y="120" width="430" height="48" rx="24" fill="${GOLD}"/>${T(545, 153, d.areaText, { s: 30, w: 800, fill: NAVY })}
${mapFrame(40, 210, 1000, 445, 'مخطط المجاورة', true)}
${mapFrame(40, 672, 490, 280, 'مخطط المدينة', false)}
${cards.map((g, i) => cardSvg(cellPos[i]![0], cellPos[i]![1], 490, 280, g)).join('')}
<rect x="40" y="1256" width="${W - 80}" height="64" rx="18" fill="${NAVY}"/>
${brand === 'unbranded' ? '' : T(W / 2, 1297, `${cfg.domain}   ·   ${cfg.phone}`, { s: 30, w: 700, fill: GOLD, ltr: true })}
</svg>`;
}

/** Render one poster PNG (with maps + logo composited) for a brand. */
export async function renderPoster(d: PosterData, brand: PosterBrand, cfg: BrandCfg): Promise<Buffer> {
  const base = await sharp(Buffer.from(baseSvg(d, brand, cfg))).png().toBuffer();
  const layers: sharp.OverlayOptions[] = [];
  if (d.neighborhoodMap) {
    try { layers.push({ input: await sharp(absU(d.neighborhoodMap)).resize(990, 435, { fit: 'cover' }).png().toBuffer(), top: 215, left: 45 }); } catch { /* skip */ }
  }
  if (d.cityMap) {
    try { layers.push({ input: await sharp(absU(d.cityMap)).resize(480, 270, { fit: 'cover' }).png().toBuffer(), top: 677, left: 45 }); } catch { /* skip */ }
  }
  if (brand !== 'unbranded' && cfg.logoPath) {
    try {
      const sq = brand === 'alsawarey';
      const logo = await sharp(await readFile(absU(cfg.logoPath))).resize(sq ? 150 : 240, sq ? 150 : 130, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(logo).metadata();
      layers.push({ input: logo, top: 48, left: W - 48 - (m.width || 150) });
    } catch { /* skip logo */ }
  }
  return sharp(base).composite(layers).png().toBuffer();
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
export type CardData = { name: string; icon: PosterGroup['icon']; rows: CardRow[]; title: string; ad: string };

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
