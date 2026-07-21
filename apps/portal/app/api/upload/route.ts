import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '@/lib/uploads';
import { stampForCategory, BAKED_CATEGORIES, type StampCategory } from '@/lib/stamp';
import { rateLimit } from '@/lib/rateLimit';

const MAX_BYTES = 32 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

// Document formats — only accepted when the caller passes kind=document (internal use).
const DOC_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Optional descriptive slug hint (image SEO): when the uploader passes ?name=<hint> the saved
// file becomes `<slug>-<shortid>.<ext>` (keyword-rich) instead of a bare uuid. Uniqueness is
// preserved by the shortid; when the hint is absent we keep the original random-uuid behavior
// (fully backward compatible). The slug keeps Arabic letters + digits, collapsing everything
// else to dashes, capped at ~60 chars.
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

// Trust the bytes, not the client-declared type. (SVG is intentionally excluded.)
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && buf.toString('ascii', 8, 12).startsWith('avif'))
    return 'image/avif';
  return null;
}

// PDF by magic bytes; ZIP-based Office formats keyed by extension (internal docs only).
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!rateLimit(`upload:${session.user.id}`, 40, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const isDoc = form.get('kind') === 'document';
  let mime = sniffMime(buf);
  let ext = mime ? EXT[mime] : null;
  if (!mime && isDoc) {
    mime = sniffDoc(buf, file.name || '');
    ext = mime ? DOC_EXT[mime] : null;
  }
  if (!mime || !ext) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 415 });
  }

  const now = new Date();
  const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(uploadRoot(), sub);
  await mkdir(dir, { recursive: true });

  // Always store the PURE original untouched (immutable — enables reversible stamping).
  // Descriptive stem from the optional ?name hint (images only; internal docs stay uuid).
  const stem = fileStem(isDoc ? null : req.nextUrl.searchParams.get('name'));
  const pureName = `${stem}.${ext}`;
  await writeFile(path.join(dir, pureName), buf);
  const purePath = `/uploads/${sub}/${pureName}`;

  // Category (module) this upload belongs to; baked categories get a stamped rendition.
  const category = !isDoc ? req.nextUrl.searchParams.get('stamp') : null;
  let displayPath = purePath;
  let displaySize = buf.length;
  if (category && (BAKED_CATEGORIES as string[]).includes(category)) {
    const stamped = Buffer.from(await stampForCategory(buf, category as StampCategory));
    if (!stamped.equals(buf)) {
      const stName = `${stem}-b.${ext}`;
      await writeFile(path.join(dir, stName), stamped);
      displayPath = `/uploads/${sub}/${stName}`;
      displaySize = stamped.length;
    }
  }

  // Bytes are on disk BEFORE the attachment row exists, so a DB failure here used to leave an
  // unowned file under /uploads that no purge job could ever identify (nothing references it).
  // Compensate: delete what we just wrote, then surface the error.
  let attachment;
  try {
    attachment = await prisma.attachment.create({
      data: {
        filename: pureName,
        originalName: file.name || pureName,
        path: displayPath,
        originalPath: purePath,
        stampCategory: category,
        mime,
        size: displaySize,
        uploaderId: session.user.id,
      },
    });
  } catch (e) {
    const written = [path.join(dir, pureName)];
    if (displayPath !== purePath) written.push(path.join(uploadRoot(), displayPath.replace(/^\/uploads\//, '')));
    await Promise.all(written.map((f) => rm(f, { force: true }).catch(() => {})));
    console.error('upload: attachment row failed, wrote-then-removed files', e);
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    attachment: {
      id: attachment.id,
      path: attachment.path,
      originalName: attachment.originalName,
      width: attachment.width,
      height: attachment.height,
    },
  });
}
