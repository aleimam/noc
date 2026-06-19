import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { uploadRoot } from '@/lib/uploads';

const MAX_BYTES = 32 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
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
  const mime = sniffMime(buf);
  if (!mime || !EXT[mime]) {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 415 });
  }

  const now = new Date();
  const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filename = `${randomUUID()}.${EXT[mime]}`;
  const dir = path.join(uploadRoot(), sub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  const attachment = await prisma.attachment.create({
    data: {
      filename,
      originalName: file.name || filename,
      path: `/uploads/${sub}/${filename}`,
      mime,
      size: file.size,
      uploaderId: session.user.id,
    },
  });

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
