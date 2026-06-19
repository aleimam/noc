import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadRoot } from '@/lib/uploads';

// Dev-only static serving of uploaded media. In production Apache serves
// /uploads/* directly via `Alias` and this route isn't hit.
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
