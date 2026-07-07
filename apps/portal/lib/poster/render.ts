import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadRoot } from '../uploads';

// Server-side listing-poster renderer (Layout A) in the approved navy/gold/cream identity.
// Built as an SVG (frame, corner brackets, gold divider, cards, footer) → sharp → PNG, with
// the two maps + the brand logo composited on top (robust; no SVG image-embedding). Requires
// the Tajawal font installed on the host (prod: /usr/share/fonts/tajawal).

export type PosterGroup = { name: string; l1: string; l2: string; icon: 'pin' | 'bld' | 'doc' };
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
const T = (x: number, y: number, t: string, o: { s?: number; w?: number; fill?: string; anchor?: string; ltr?: boolean } = {}) =>
  `<text x="${x}" y="${y}" font-family="Tajawal" font-size="${o.s ?? 28}" font-weight="${o.w ?? 400}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? 'middle'}"${o.ltr ? ' direction="ltr"' : ''}>${esc(t)}</text>`;
const dvd = (cx: number, y: number, half: number) =>
  `<line x1="${cx - half}" y1="${y}" x2="${cx - 9}" y2="${y}" stroke="${GOLD}" stroke-width="3"/>` +
  `<line x1="${cx + 9}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="${GOLD}" stroke-width="3"/>` +
  `<rect x="${cx - 6}" y="${y - 6}" width="12" height="12" fill="${GOLD}" transform="rotate(45 ${cx} ${y})"/>`;
const GLYPH: Record<PosterGroup['icon'], string> = {
  pin: `<path d="M0,-16 C-9,-16 -16,-9 -16,0 C-16,10 0,22 0,22 C0,22 16,10 16,0 C16,-9 9,-16 0,-16 Z" fill="${GOLD}"/><circle cx="0" cy="-1" r="5.5" fill="${NAVY}"/>`,
  bld: `<rect x="-15" y="-6" width="12" height="20" fill="${GOLD}"/><rect x="1" y="-15" width="14" height="29" fill="${GOLD}"/><rect x="4" y="-11" width="3" height="3" fill="${NAVY}"/><rect x="9" y="-11" width="3" height="3" fill="${NAVY}"/>`,
  doc: `<rect x="-13" y="-16" width="26" height="32" rx="3" fill="${GOLD}"/><line x1="-7" y1="-8" x2="7" y2="-8" stroke="${NAVY}" stroke-width="2.5"/><line x1="-7" y1="0" x2="7" y2="0" stroke="${NAVY}" stroke-width="2.5"/><line x1="-7" y1="8" x2="3" y2="8" stroke="${NAVY}" stroke-width="2.5"/>`,
};

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

/** Persist a PNG buffer under /uploads/<yyyy>/<mm>/<uuid>.png. */
export async function savePng(buf: Buffer): Promise<{ path: string; filename: string; size: number }> {
  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const filename = `${randomUUID()}.png`;
  await mkdir(path.join(uploadRoot(), rel), { recursive: true });
  await writeFile(path.join(uploadRoot(), rel, filename), buf);
  return { path: `/uploads/${rel}/${filename}`, filename, size: buf.length };
}
