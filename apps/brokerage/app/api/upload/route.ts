import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../lib/uploads';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

// Public upload for the "sell your land" form (visitors aren't logged in). Accepts images,
// plus documents (PDF/DOCX/XLSX) when kind=document. Bytes are sniffed, not trusted.
// Logged-in users (partners) get uploaderId set so the partner listing save can claim
// their photos (it filters by uploaderId — without it partner photos were silently dropped).
const MAX_BYTES = 32 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };
const DOC_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Optional descriptive slug hint (image SEO): when the uploader passes ?name=<hint> the saved
// file becomes `<slug>-<shortid>.<ext>` instead of a bare uuid. Uniqueness is preserved by the
// shortid; absent hint keeps the original random-uuid behavior. Mirrors the portal upload route.
function slugifyHint(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
function fileStem(hint: string | null | undefined): string {
  const slug = slugifyHint(hint);
  return slug ? `${slug}-${randomUUID().slice(0, 8)}` : randomUUID();
}

function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && buf.toString('ascii', 8, 12).startsWith('avif')) return 'image/avif';
  return null;
}

function sniffDoc(buf: Buffer, name: string): string | null {
  if (buf.length < 4) return null;
  if (buf.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const ext = name.toLowerCase().split('.').pop();
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Optional session: partner pages upload logged-in; the public sell form doesn't.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  // Anonymous callers are keyed by IP so the sell form can't be abused to fill disk (F1);
  // logged-in users get the same per-user allowance as the portal upload route.
  const rlKey = userId ? `upload:u:${userId}` : `upload:${clientIp(req.headers)}`;
  if (!rateLimit(rlKey, userId ? 40 : 20, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const isDoc = form.get('kind') === 'document';
  let mime = sniff(buf);
  let ext = mime ? EXT[mime] : null;
  if (!mime && isDoc) {
    mime = sniffDoc(buf, file.name || '');
    ext = mime ? DOC_EXT[mime] : null;
  }
  if (!mime || !ext) return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 415 });

  const now = new Date();
  const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Descriptive stem from the optional ?name hint (images only; internal docs stay uuid).
  const filename = `${fileStem(isDoc ? null : req.nextUrl.searchParams.get('name'))}.${ext}`;
  const dir = path.join(uploadRoot(), sub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  const purePath = `/uploads/${sub}/${filename}`;
  // Honor the ?stamp=<category> tag the shared partner form sends (mirrors the portal upload
  // route): keep the pure original in originalPath + record the stamping category, so the
  // portal-side re-stamp pipeline (restampListingPhotos on staff save) bakes the watermark
  // from the untouched original. This app has no stamping engine, so no rendition is baked here.
  const category = !isDoc ? req.nextUrl.searchParams.get('stamp') : null;

  // ownerType left null (draft) until the offer / partner listing action links it.
  // MIRRORS the portal route: the bytes hit disk before the row exists, so a DB failure would
  // leave a file under /uploads that nothing references and no purge job could ever identify.
  // Compensate by removing what we just wrote, then surface the error.
  let attachment;
  try {
    attachment = await prisma.attachment.create({
      data: {
        filename,
        originalName: file.name || filename,
        path: purePath,
        originalPath: purePath,
        stampCategory: category,
        mime,
        size: file.size,
        ...(userId ? { uploaderId: userId } : {}),
      },
    });
  } catch (e) {
    await rm(path.join(dir, filename), { force: true }).catch(() => {});
    console.error('upload: attachment row failed, wrote-then-removed file', e);
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, attachment: { id: attachment.id, path: attachment.path, originalName: attachment.originalName, mime } });
}
