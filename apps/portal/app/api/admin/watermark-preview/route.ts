import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { auth, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '@/lib/uploads';
import { stampPreview, STAMP_CATEGORIES, type StampCategory, type StampConfig } from '@/lib/stamp';

export const dynamic = 'force-dynamic';

const PREVIEW_W = 760;
const abs = (p: string) => path.join(uploadRoot(), p.replace(/^\/uploads\//, ''));

/** A real, CLEAN (unstamped) sample photo of the requested category — so the preview shows the
 *  stamp on a photo of the same type. Falls back to any listing photo, then any photo, then a
 *  generated placeholder card when the library has no photos yet. Always ~760px wide (fast). */
async function sampleBuffer(cat: StampCategory): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  let rel: string | null = null;
  // Maps live as AreaMap.cleanPath (not category-tagged Attachments) — sample a real clean map.
  if (cat === 'map' || cat === 'map-newobour') {
    const m = await prisma.areaMap.findFirst({ select: { cleanPath: true } });
    rel = m?.cleanPath ?? null;
  }
  if (!rel) {
    const pick = (where: Record<string, unknown>) =>
      prisma.attachment.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { originalPath: true, path: true } });
    const row =
      (await pick({ stampCategory: cat, originalPath: { not: null }, mime: { startsWith: 'image/' } })) ??
      (await pick({ stampCategory: 'listing', originalPath: { not: null }, mime: { startsWith: 'image/' } })) ??
      (await pick({ originalPath: { not: null }, mime: { startsWith: 'image/' } }));
    rel = row?.originalPath ?? row?.path ?? null;
  }
  if (rel) {
    try {
      return await sharp(await readFile(abs(rel))).rotate().resize({ width: PREVIEW_W, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    } catch {
      /* file missing on disk → fall through to placeholder */
    }
  }
  const h = Math.round(PREVIEW_W * 0.66);
  const svg = `<svg width="${PREVIEW_W}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1f4b"/><stop offset="1" stop-color="#33507f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" fill="#ffffff" font-family="Arial,sans-serif" font-size="34" text-anchor="middle" dominant-baseline="middle" opacity="0.85">صورة تجريبية</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user || user.type !== 'STAFF' || !hasPermission(user.perms ?? [], 'appearance', 'VIEW')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { category?: string; config?: StampConfig };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const cat: StampCategory = (STAMP_CATEGORIES as string[]).includes(body.category ?? '') ? (body.category as StampCategory) : 'listing';
  const cfg = body.config;
  if (!cfg || typeof cfg !== 'object') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const out = await stampPreview(cat, cfg, await sampleBuffer(cat));
    return new NextResponse(new Uint8Array(out), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('watermark-preview failed', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
