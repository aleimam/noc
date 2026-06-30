import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../lib/uploads';

// Public image upload for the "sell your land" form (visitors aren't logged in).
// Images only; bytes are sniffed, not trusted from the client. Stored as Attachments.
const MAX_BYTES = 32 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };

function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && buf.toString('ascii', 8, 12).startsWith('avif')) return 'image/avif';
  return null;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  const ext = mime ? EXT[mime] : null;
  if (!mime || !ext) return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 415 });

  const now = new Date();
  const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(uploadRoot(), sub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  // ownerType left null (draft) until the offer action links it.
  const attachment = await prisma.attachment.create({
    data: { filename, originalName: file.name || filename, path: `/uploads/${sub}/${filename}`, mime, size: file.size },
  });
  return NextResponse.json({ ok: true, attachment: { id: attachment.id, path: attachment.path } });
}
