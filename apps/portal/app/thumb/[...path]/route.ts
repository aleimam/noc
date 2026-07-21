import { NextResponse, type NextRequest } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { uploadRoot } from '../../../lib/uploads';
import { clientIp, rateLimit } from '../../../lib/rateLimit';

// On-demand card-cover thumbnails: /thumb/w480/2026/07/x.png resizes /uploads/2026/07/x.png
// to 480px-wide WebP (q72), caches the result under <uploads>/.thumbs/w480/… and serves it
// immutable. Full-size stamped PNGs (1–2 MB each) were being used as card covers — on mobile
// data that made the storefront home ~3.4 MB. ⚠️ MIRROR of the brokerage route — keep in sync.
const WIDTHS = new Set(['320', '480', '640', '960']);
const EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const [wPart, ...rest] = parts ?? [];
  const w = (wPart ?? '').replace(/^w/, '');
  if (!WIDTHS.has(w) || rest.length === 0) return new NextResponse('Not found', { status: 404 });

  const safe = rest.filter((p) => p && p !== '..' && !p.includes('/') && !p.includes('\\'));
  const root = uploadRoot();
  const src = path.join(root, ...safe);
  if (!path.resolve(src).startsWith(path.resolve(root))) return new NextResponse('Not found', { status: 404 });
  if (!EXTS.has(path.extname(src).slice(1).toLowerCase())) return new NextResponse('Not found', { status: 404 });

  const headers = { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' };
  const cacheFile = `${path.join(root, '.thumbs', `w${w}`, ...safe)}.webp`;
  try {
    const cached = await readFile(cacheFile);
    return new NextResponse(new Uint8Array(cached), { headers });
  } catch {
    /* not cached yet */
  }
  // Cache HITS stay unmetered (they're a file read). Only MISSES are rate-limited: each one
  // runs sharp and writes an immutable cache file, so walking valid paths × 4 widths was an
  // uncapped CPU/disk sink. A real visitor triggers a handful of misses per page.
  if (!rateLimit(`thumbmiss:${clientIp(_req.headers)}`, 60, 60_000)) {
    return new NextResponse('Too many requests', { status: 429 });
  }
  try {
    const buf = await sharp(src)
      .rotate() // honour EXIF orientation
      .resize({ width: Number(w), withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    await mkdir(path.dirname(cacheFile), { recursive: true })
      .then(() => writeFile(cacheFile, buf))
      .catch(() => {}); // cache write is best-effort — still serve the bytes
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
