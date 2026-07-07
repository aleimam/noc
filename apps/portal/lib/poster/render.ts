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
const NAVY = '#0f1f4b', GOLD = '#e7ab16', GOLD2 = '#c9983e', CREAM = '#fdfaf3', INK = '#2b3a53';
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
const T = (x: number, y: number, t: string, o: { s?: number; w?: number; fill?: string; anchor?: string; ltr?: boolean } = {}) => {
  const a = o.anchor ?? 'middle';
  const anchor = o.ltr ? a : a === 'end' ? 'start' : a === 'start' ? 'end' : a;
  return `<text x="${x}" y="${y}" font-family="Tajawal" font-size="${o.s ?? 28}" font-weight="${o.w ?? 400}" fill="${o.fill ?? INK}" text-anchor="${anchor}" direction="${o.ltr ? 'ltr' : 'rtl'}">${esc(o.ltr ? t : rtl(t))}</text>`;
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

// ── Per-group card (banner-pros frame): icon panel + name + gold divider + area pill +
//    the group's attribute lines. Branded only (New Obour / Al Sawarey). ──
export type CardData = { name: string; lines: string[]; icon: PosterGroup['icon']; areaShort: string };

export async function renderCard(d: CardData, brand: Exclude<PosterBrand, 'unbranded'>, cfg: BrandCfg): Promise<Buffer> {
  const w = 1000, h = 400, cx = 657;
  const lines = d.lines.filter(Boolean).slice(0, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#ffffff"/>
<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="26" fill="none" stroke="${GOLD}" stroke-width="6"/>
${brackets(w, h)}
<rect x="16" y="16" width="300" height="${h - 32}" rx="22" fill="${NAVY}"/>
<g transform="translate(166 150) scale(3.4)">${GLYPH[d.icon]}</g>
${T(cx, 110, d.name, { s: 46, w: 800, fill: NAVY })}
${dvd(cx, 155, 250)}
${d.areaShort ? `<rect x="${cx - 150}" y="176" width="300" height="46" rx="23" fill="${GOLD}"/>${T(cx, 208, d.areaShort, { s: 26, w: 800, fill: NAVY })}` : ''}
${lines.map((ln, i) => T(cx, 272 + i * 40, ln, { s: 26, w: 500, fill: INK })).join('')}
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const layers: sharp.OverlayOptions[] = [];
  if (cfg.logoPath) {
    try {
      const sq = brand === 'alsawarey';
      const logo = await sharp(await readFile(absU(cfg.logoPath))).resize(sq ? 116 : 200, sq ? 116 : 66, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(logo).metadata();
      layers.push({ input: logo, top: h - 24 - (m.height || 70), left: 166 - (m.width || 116) / 2 });
    } catch { /* skip */ }
  }
  return sharp(base).composite(layers).png().toBuffer();
}

// ── Advantages photo (Price Benefits style): a header + one gold section bar per level
//    (City/District/Neighborhood) with its advantage bullets. Branded only. ──
export type AdvGroup = { title: string; items: string[] };

export async function renderAdvantages(groups: AdvGroup[], heading: string, brand: Exclude<PosterBrand, 'unbranded'>, cfg: BrandCfg): Promise<Buffer> {
  const usable = groups.filter((g) => g.items.length > 0);
  // Measure the block (same advances as the draw loop) and center it vertically in
  // the window between the heading divider and the footer — with few advantages the
  // old fixed start left a large void at the bottom.
  const blockH = usable.reduce((h, g) => h + 72 + g.items.length * 44 + 18, 0) - (usable.length ? 18 : 0);
  const top = 230, bottom = 1246;
  const parts: string[] = [];
  let y = top + Math.max(20, (bottom - top - blockH) / 2);
  for (const g of usable) {
    if (y > 1170) continue;
    parts.push(`<rect x="60" y="${y}" width="960" height="52" rx="12" fill="${GOLD}"/>` + T(996, y + 36, g.title, { s: 30, w: 800, fill: NAVY, anchor: 'end' }));
    y += 72;
    for (const it of g.items) {
      if (y > 1210) break;
      parts.push(`<rect x="972" y="${y - 20}" width="13" height="13" fill="${GOLD}" transform="rotate(45 978 ${y - 13})"/>` + T(948, y, it.slice(0, 62), { s: 26, w: 500, fill: INK, anchor: 'end' }));
      y += 44;
    }
    y += 18;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${CREAM}"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="${GOLD}" stroke-width="6"/>
${brackets(W, H)}
${T(540, 150, heading, { s: 46, w: 800, fill: NAVY })}
${dvd(540, 194, 260)}
${parts.join('')}
<rect x="40" y="1256" width="${W - 80}" height="64" rx="18" fill="${NAVY}"/>
${T(W / 2, 1297, `${cfg.domain}   ·   ${cfg.phone}`, { s: 30, w: 700, fill: GOLD, ltr: true })}
</svg>`;
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const layers: sharp.OverlayOptions[] = [];
  if (cfg.logoPath) {
    try {
      const sq = brand === 'alsawarey';
      const logo = await sharp(await readFile(absU(cfg.logoPath))).resize(sq ? 140 : 230, sq ? 140 : 120, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(logo).metadata();
      layers.push({ input: logo, top: 44, left: W - 48 - (m.width || 140) });
    } catch { /* skip */ }
  }
  return sharp(base).composite(layers).png().toBuffer();
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
