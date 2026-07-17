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
// Poster = consolidated Layout A (owner-approved 2026-07-08): header band (title + ad
// pill), big listing location map, then a 2-column COLUMN-major grid of the marked group
// tables — cards read down the LEFT column then the RIGHT, city map in the last slot
// (owner's numbered mock 2026-07-17) — then the footer strip. Unbranded drops logo+contacts.
//
// All colors + the font come from a per-brand PosterTheme (admin-editable via the
// Setting `posterTheme.<brand>`); the defaults below are the owner-approved identity.

export type PosterCardGroup = { name: string; icon: PosterIconKey; rows: CardRow[] };
export type PosterData = {
  ad: string; // '#YYMM…' or '' before publish
  title: string; // staff Card Title (upstream falls back to the listing title)
  areaRows: CardRow[]; // the Area group attributes → header table columns (with the ad no.)
  groups: PosterCardGroup[]; // admin-marked groups (or the first-3 fallback), Area excluded
  neighborhoodMap: string | null; // public /uploads path (the annotated location map)
  cityMap: string | null; // public /uploads path (city masterplan)
};
export type PosterBrand = 'newobour' | 'alsawarey' | 'unbranded';
export type PosterTheme = { navy: string; gold: string; cream: string; tint: string; ink: string; font: string };
export type BrandCfg = {
  logoPath: string | null;
  domain: string;
  phone: string;
  headerLogoPath?: string | null;
  /** Poster header arrangement: 'side' (default — info table beside the title) or
   *  'row' (info table as one full-width row below the band; title gets the whole line). */
  headerLayout?: 'side' | 'row';
  theme?: Partial<PosterTheme>;
};
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

/** Split a title into up to two balanced lines (for the poster header). */
function splitTwoLines(s: string): string[] {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2 || s.length <= 16) return [s];
  let best = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

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
  const whatsappGlyph = (bubble: string, hand: string) =>
    `<path d="M0,-12 A12,12 0 1 0 -10.4,6 L-12.2,12.2 L-5.4,10.2 A12,12 0 0 0 0,-12 Z" fill="${bubble}"/>` +
    `<path d="M-4.5,-4.8 C-5.1,-4.7 -5.6,-4 -5.5,-3.1 C-5.1,0.7 -1.3,4.6 2.5,4.9 C3.4,5 4.1,4.4 4.2,3.7 L4.4,2.6 C4.5,2.1 4.2,1.6 3.6,1.5 L1.6,1.1 C1.1,1 0.7,1.2 0.5,1.6 L0,2.4 C-1.8,1.5 -3.2,0.1 -4,-1.7 L-3.2,-2.3 C-2.9,-2.5 -2.7,-2.9 -2.8,-3.4 L-3.2,-5.4 C-3.3,-6 -3.8,-6.3 -4.4,-6.1 Z" fill="${hand}"/>`;
  const globeGlyph = (c: string) =>
    `<circle cx="0" cy="0" r="11" fill="none" stroke="${c}" stroke-width="2"/>` +
    `<line x1="-11" y1="0" x2="11" y2="0" stroke="${c}" stroke-width="1.5"/>` +
    `<line x1="0" y1="-11" x2="0" y2="11" stroke="${c}" stroke-width="1.2"/>` +
    `<ellipse cx="0" cy="0" rx="5.5" ry="11" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  const estTextW = (s: string, fs: number, ltr: boolean) => Math.ceil(s.length * fs * (ltr ? 0.58 : 0.5));

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
    const headH = 46, rowH = 42;
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
        // attribute name: normal weight; value: bold + bigger (owner request 2026-07-09)
        T(x + w - 20, ry + rowH / 2 + 6, r.label, { s: 19, w: 400, fill: th.navy, anchor: 'end' }),
        T(x + 18, ry + rowH / 2 + 8, clipText(r.value, 26), { s: 24, w: 800, fill: th.ink, anchor: 'start' }),
      );
    });
    return { svg: parts.join(''), h };
  };

  return { T, dvd, glyph, phoneGlyph, whatsappGlyph, globeGlyph, estTextW, cardChrome, sealFooter, plainFooter, tableRow, compactCard };
}

/** Sample the header logo's own background (top-left corner pixel) so the poster header
 *  bar can BE that color — the logo then sits flush on the bar with no white plate
 *  (owner request 2026-07-09). Returns the bar fill (logo bg when opaque, else theme
 *  navy), a title text color that contrasts with it, and the letterbox background to
 *  pad the logo onto the bar seamlessly. */
async function headerLogoBg(logoPath: string | null, th: PosterTheme): Promise<{ bar: string; text: string; bg: sharp.Color }> {
  const navy = { bar: th.navy, text: '#ffffff', bg: { r: 0, g: 0, b: 0, alpha: 0 } as sharp.Color };
  if (!logoPath) return navy;
  try {
    const px = await sharp(await readFile(absU(logoPath))).ensureAlpha().extract({ left: 1, top: 1, width: 1, height: 1 }).raw().toBuffer();
    if ((px[3] ?? 0) < 200) return navy; // transparent logo → keep the navy bar showing through
    const [r, g, b] = [px[0]!, px[1]!, px[2]!];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return { bar: `rgb(${r},${g},${b})`, text: lum > 0.6 ? th.navy : '#ffffff', bg: { r, g, b, alpha: 1 } };
  } catch {
    return navy;
  }
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

// ── Per-group card (owner-approved "Card A", 2026-07-09): frameless. A navy header
//    band carries the GROUP NAME + an icon disc (right) and the ad-number pill (left) —
//    no listing title, no outer frame/corner brackets. Rows sit straight on the cream
//    background (alternating tint/white, gold diamond marker), then the seal footer.
//    Branded only. ──
export async function renderCard(d: CardData, brand: Exclude<PosterBrand, 'unbranded'>, cfg: BrandCfg): Promise<Buffer> {
  const th = resolveTheme(cfg);
  const { T, glyph, sealFooter } = helpers(th);
  const w = W;
  let y = 176;
  const parts: string[] = [];
  for (let i = 0; i < Math.min(d.rows.length, 5); i++) {
    const { label, value } = d.rows[i]!;
    const lines = wrapValue(value);
    const rh = lines.length > 1 ? 96 : 70;
    parts.push(
      `<rect x="50" y="${y}" width="${w - 100}" height="${rh}" rx="14" fill="${i % 2 ? '#ffffff' : th.tint}"/>`,
      `<rect x="${w - 76}" y="${y + rh / 2 - 6}" width="12" height="12" fill="${th.gold}" transform="rotate(45 ${w - 70} ${y + rh / 2})"/>`,
      // attribute name: normal weight; value: bold + bigger (owner request 2026-07-09)
      T(w - 102, y + (lines.length > 1 ? rh / 2 + 8 : 44), label, { s: 22, w: 400, fill: th.navy, anchor: 'end' }),
    );
    lines.forEach((ln, li) => parts.push(T(w / 2 - 100, y + (lines.length > 1 ? 42 + li * 38 : 46), ln, { s: 31, w: 800, fill: th.ink })));
    y += rh + 12;
  }
  const badge = await badgeLogo(cfg, th);
  const foot = sealFooter(w, y + 10, cfg, badge.fill);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${foot.h}" viewBox="0 0 ${w} ${foot.h}">
<rect width="${w}" height="${foot.h}" fill="${th.cream}"/>
<rect x="36" y="40" width="${w - 72}" height="100" rx="20" fill="${th.navy}"/>
${d.ad ? `<rect x="62" y="66" width="170" height="48" rx="12" fill="none" stroke="${th.gold}" stroke-width="2.5"/>${T(147, 98, d.ad, { s: 25, w: 700, fill: th.gold, ltr: true })}` : ''}
<circle cx="${w - 104}" cy="90" r="30" fill="${th.gold}" opacity="0.2"/><g transform="translate(${w - 104} 90) scale(1.05)">${glyph(d.icon)}</g>
${T(w - 152, 104, d.name, { s: 38, w: 800, fill: '#ffffff', anchor: 'end' })}
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

/** Render one consolidated poster PNG (owner-approved v11, 2026-07-09). No outer frame.
 *  Header = horizontal logo (or a placeholder until one is uploaded) + a content-width
 *  table (ad no. + Area attributes) + a 2-line title. The listing location map spans the
 *  full width with its height following the map's own aspect ratio (so poster height
 *  varies per listing). Then a 2-col grid of the city map (5:4) + group cards, and a
 *  footer with phone + WhatsApp icons and a globe + domain (no seal badge). */
export async function renderPoster(d: PosterData, brand: PosterBrand, cfg: BrandCfg): Promise<Buffer> {
  const th = resolveTheme(cfg);
  const { T, phoneGlyph, whatsappGlyph, globeGlyph, estTextW, compactCard } = helpers(th);
  const w = W, M = 24, gap = 18;
  const branded = brand !== 'unbranded';
  const parts: string[] = [];

  // ── Header band: the bar takes the logo's OWN background color so the logo sits flush
  //    on it (no white plate); the title text flips light/dark to stay legible. ──
  const headY = M, headH = 130, cy = headY + headH / 2;
  const hasLogo = branded && !!cfg.headerLogoPath;
  const hb = await headerLogoBg(hasLogo ? cfg.headerLogoPath! : null, th);
  parts.push(`<rect x="${M}" y="${headY}" width="${w - 2 * M}" height="${headH}" rx="18" fill="${hb.bar}"/>`);
  const plate = { x: M + 16, y: cy - 50, w: 210, h: 100 };
  if (branded && !hasLogo) {
    // branded, pre-upload state only: a white plate with a dashed "logo" placeholder.
    // (Unbranded posters are intentionally logo-free — no placeholder.)
    parts.push(
      `<rect x="${plate.x}" y="${plate.y}" width="${plate.w}" height="${plate.h}" rx="12" fill="#ffffff"/>`,
      `<rect x="${plate.x + 8}" y="${plate.y + 8}" width="${plate.w - 16}" height="${plate.h - 16}" rx="8" fill="none" stroke="#b9c0cc" stroke-width="2" stroke-dasharray="7 6"/>`,
      T(plate.x + plate.w / 2, cy + 7, 'الشعار', { s: 20, w: 700, fill: '#9aa3b2' }),
    );
  }
  const logoBox = { left: plate.x + 6, top: plate.y + 5, w: plate.w - 12, h: plate.h - 10 };

  // Header info pairs (ad number + up to 3 Area attributes) — used by BOTH header layouts.
  const infoPairs = [
    ...(d.ad ? [{ title: 'رقم الإعلان', value: d.ad, ltr: true }] : []),
    ...d.areaRows.slice(0, 3).map((r) => ({ title: r.label, value: r.value, ltr: false })),
  ];
  // Header layout (admin switch, Setting posterTheme.<brand>.headerLayout, 2026-07-17):
  //   'side' (default) — classic compact: 2-row info table BESIDE the title in the band.
  //   'row'            — owner's alternative: the info table becomes ONE full-width row of
  //                      label|value cells BELOW the band, so the title gets the whole line.
  const layoutRow = cfg.headerLayout === 'row';

  let titleStart = branded ? plate.x + plate.w + 24 : M + 16; // 'row': title runs to the logo
  if (!layoutRow) {
    // content-width table: ad number + Area attributes (bigger values)
    const tableCols = infoPairs.map((c) => ({ ...c, cw: Math.max(Math.max(estTextW(c.title, 17, false), estTextW(c.value, 27, c.ltr)) + 30, 96) }));
    const tabW = tableCols.reduce((a, c) => a + c.cw, 0);
    const tabX = plate.x + plate.w + 24;
    const r1H = 38, r2H = 52, tabY = cy - (r1H + r2H) / 2, r1Y = tabY, r2Y = tabY + r1H;
    let cxp = tabX + tabW;
    for (const c of tableCols) {
      cxp -= c.cw;
      const mid = cxp + c.cw / 2;
      parts.push(
        `<rect x="${cxp}" y="${r1Y}" width="${c.cw}" height="${r1H}" fill="${th.gold}" stroke="${th.navy}" stroke-width="1.5"/>`,
        T(mid, r1Y + 26, c.title, { s: 17, w: 800, fill: th.navy }),
        `<rect x="${cxp}" y="${r2Y}" width="${c.cw}" height="${r2H}" fill="${th.cream}" stroke="${th.navy}" stroke-width="1.5"/>`,
        T(mid, r2Y + 35, c.value, { s: 27, w: 800, fill: th.navy, ltr: c.ltr }),
      );
    }
    titleStart = tabX + tabW + 20;
  }

  // One-row info table below the band ('row' layout): [label|value] × pairs, right→left.
  let infoRowH = 0;
  if (layoutRow && infoPairs.length) {
    infoRowH = 56;
    const infoY = headY + headH + gap;
    const cw2 = (w - 2 * M) / (infoPairs.length * 2);
    let cx2 = w - M;
    for (const p of infoPairs) {
      cx2 -= cw2;
      parts.push(
        `<rect x="${cx2}" y="${infoY}" width="${cw2}" height="${infoRowH}" fill="${th.gold}" stroke="${th.navy}" stroke-width="1.5"/>`,
        T(cx2 + cw2 / 2, infoY + 36, p.title, { s: 20, w: 800, fill: th.navy }),
      );
      cx2 -= cw2;
      parts.push(
        `<rect x="${cx2}" y="${infoY}" width="${cw2}" height="${infoRowH}" fill="${th.cream}" stroke="${th.navy}" stroke-width="1.5"/>`,
        T(cx2 + cw2 / 2, infoY + 38, p.value, { s: 26, w: 800, fill: th.navy, ltr: p.ltr }),
      );
    }
  }

  // Title on the right, up to two lines — CAPPED to the space left of it (the ad/area
  // table in 'side' layout, the logo in 'row' layout). Long titles used to run leftward
  // over the رقم الإعلان pill and the area values (fixed 2026-07-17): shrink the font to
  // fit (floor 20px), then ellipsis-clip as a last resort so the header never overprints.
  const titleEnd = w - M - 16;
  const titleMax = Math.max(titleEnd - titleStart, 200);
  const tl = splitTwoLines(d.title);
  const widest = Math.max(...tl.map((s) => estTextW(s, 33, false)));
  const ts = widest > titleMax ? Math.max(20, Math.floor((33 * titleMax) / widest)) : 33;
  const fitLine = (s: string): string => {
    if (estTextW(s, ts, false) <= titleMax) return s;
    let out = s;
    while (out.length > 1 && estTextW(out + '…', ts, false) > titleMax) out = out.slice(0, -1);
    return out.trimEnd() + '…';
  };
  const lines = tl.map(fitLine);
  if (lines.length === 2) {
    parts.push(T(titleEnd, cy - 8, lines[0]!, { s: ts, w: 800, fill: hb.text, anchor: 'end' }));
    parts.push(T(titleEnd, cy + 32, lines[1]!, { s: ts, w: 800, fill: hb.text, anchor: 'end' }));
  } else {
    parts.push(T(titleEnd, cy + 12, lines[0]!, { s: ts, w: 800, fill: hb.text, anchor: 'end' }));
  }

  // ── Big listing location map: full width, height from the map's own aspect ratio ──
  const bigW = w - 2 * M;
  let bigH = Math.round(bigW * 0.72);
  if (d.neighborhoodMap) {
    try { const m = await sharp(absU(d.neighborhoodMap)).metadata(); if (m.width && m.height) bigH = Math.round(bigW * (m.height / m.width)); } catch { /* keep fallback */ }
  }
  const bigY = headY + headH + gap + (infoRowH ? infoRowH + gap : 0);
  let y = bigY;
  let bigBox: { top: number; left: number; w: number; h: number } | null = null;
  if (d.neighborhoodMap) {
    parts.push(`<rect x="${M}" y="${bigY}" width="${bigW}" height="${bigH}" rx="14" fill="#eef0f4" stroke="${th.gold}" stroke-width="2"/>`);
    bigBox = { top: bigY, left: M, w: bigW, h: bigH };
    y = bigY + bigH + gap;
  }

  // ── 2-col grid, COLUMN-major (owner's numbered mock, corrected 2026-07-17): slot 1 =
  // the city/district location map (top-left), then the group cards in form order reading
  // down the LEFT column and continuing down the RIGHT (…map, group1, group2, group3…).
  const colW = (bigW - gap) / 2;
  type Cell = { kind: 'card'; g: PosterCardGroup } | { kind: 'city' };
  const cells: Cell[] = d.groups.map((g) => ({ kind: 'card' as const, g }));
  if (d.cityMap) cells.unshift({ kind: 'city' });

  const half = Math.ceil(cells.length / 2);
  const leftCol = cells.slice(0, half);
  const rightCol = cells.slice(half);

  const cardH = (g: PosterCardGroup) => 46 + Math.min(g.rows.length, 5) * 42 + 10;
  const CITY_H = Math.round(colW * 4 / 5);
  let cityBox: { top: number; left: number; w: number; h: number } | null = null;
  for (let i = 0; i < half; i++) {
    const row: Array<{ c: Cell; x: number }> = [];
    if (leftCol[i]) row.push({ c: leftCol[i]!, x: M });
    if (rightCol[i]) row.push({ c: rightCol[i]!, x: M + colW + gap });
    const hasCity = row.some((r) => r.c.kind === 'city');
    const rowH = Math.max(...row.map((r) => (r.c.kind === 'card' ? cardH(r.c.g) : 0)), hasCity ? CITY_H : 256);
    for (const { c, x } of row) {
      if (c.kind === 'card') parts.push(compactCard(x, y, colW, c.g, rowH).svg);
      else {
        parts.push(`<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" rx="14" fill="#eef0f4" stroke="${th.gold}" stroke-width="2"/>`);
        cityBox = { top: y + 4, left: Math.round(x) + 4, w: Math.round(colW) - 8, h: rowH - 8 };
      }
    }
    y += rowH + gap;
  }
  const bottom = y - gap;

  // ── Footer: phone + WhatsApp icons (left), globe + domain (right); no seal badge ──
  const fy = bottom + gap, stripH = 70, sy = fy + 10 + stripH / 2;
  let footSvg: string;
  if (branded) {
    const domW = estTextW(cfg.domain, 26, true);
    const domEnd = w - M - 32, domStart = domEnd - domW;
    footSvg =
      `<line x1="${M}" y1="${fy + 4}" x2="${w - M}" y2="${fy + 4}" stroke="${th.gold}" stroke-width="3"/>` +
      `<rect x="${M}" y="${fy + 10}" width="${w - 2 * M}" height="${stripH}" rx="16" fill="${th.navy}"/>` +
      `<g transform="translate(${M + 56} ${sy})">${phoneGlyph(th.gold)}</g>` +
      `<g transform="translate(${M + 95} ${sy})">${whatsappGlyph(th.gold, th.navy)}</g>` +
      T(M + 128, sy + 9, cfg.phone, { s: 26, w: 700, fill: th.gold, ltr: true, anchor: 'start' }) +
      `<g transform="translate(${domStart - 22} ${sy})">${globeGlyph('#ffffff')}</g>` +
      T(domEnd, sy + 9, cfg.domain, { s: 26, w: 700, fill: '#ffffff', ltr: true, anchor: 'end' });
  } else {
    footSvg = `<line x1="${M}" y1="${fy + 4}" x2="${w - M}" y2="${fy + 4}" stroke="${th.gold}" stroke-width="3"/><rect x="${M}" y="${fy + 10}" width="${w - 2 * M}" height="34" rx="12" fill="${th.navy}"/>`;
  }
  const h = fy + 10 + (branded ? stripH : 34) + M;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${th.cream}"/>
${parts.join('')}
${footSvg}
</svg>`;

  const layers: sharp.OverlayOptions[] = [];
  if (d.neighborhoodMap && bigBox) {
    // box matches the map's ratio → fill shows it whole, no distortion
    try { layers.push({ input: await sharp(absU(d.neighborhoodMap)).resize(bigBox.w, bigBox.h, { fit: 'fill' }).png().toBuffer(), top: bigBox.top, left: bigBox.left }); } catch { /* skip */ }
  }
  if (d.cityMap && cityBox) {
    try { layers.push({ input: await sharp(absU(d.cityMap)).resize(cityBox.w, cityBox.h, { fit: 'contain', background: '#eef0f4' }).png().toBuffer(), top: cityBox.top, left: cityBox.left }); } catch { /* skip */ }
  }
  if (hasLogo && cfg.headerLogoPath) {
    // letterbox the logo with its own bg color so it blends into the same-colored bar
    try { layers.push({ input: await sharp(absU(cfg.headerLogoPath)).resize(logoBox.w, logoBox.h, { fit: 'contain', background: hb.bg }).png().toBuffer(), top: logoBox.top, left: logoBox.left }); } catch { /* skip */ }
  }
  return sharp(Buffer.from(svg)).png().composite(layers).toBuffer();
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
