import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadRoot } from '../../../lib/uploads';

// Serve uploaded media on the ALSWARY domain (land photos, maps, brand assets). Mirrors the
// portal route so alsawarey.com/uploads/* works even when the web server's /uploads alias is
// scoped to the New Obour vhost. In production a web-server Alias may serve these directly.
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const safe = parts.filter((p) => p && p !== '..' && !p.includes('/') && !p.includes('\\'));
  const root = uploadRoot();
  const filePath = path.join(root, ...safe);
  if (!path.resolve(filePath).startsWith(path.resolve(root))) {
    return new NextResponse('Not found', { status: 404 });
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
