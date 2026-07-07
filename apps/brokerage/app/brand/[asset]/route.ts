import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@noc/db';
import { uploadRoot } from '../../../lib/uploads';

// Stable brand-asset URLs for Al Sawarey, editable from the New Obour backend. The stored
// value is usually an uploaded /uploads/... path — we STREAM its bytes from the shared
// disk rather than redirecting, so the asset loads on alsawarey.com regardless of whether
// the web server aliases /uploads for this vhost (fixes the logo not appearing). Absolute
// URLs are redirected; when unset we fall back to the bundled /logo.png.
const MAP: Record<string, string> = {
  logo: 'brand_alsawarey_logo',
  'logo-dark': 'brand_alsawarey_logo_dark',
  favicon: 'brand_alsawarey_favicon',
};

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  const key = MAP[asset];
  const value = key ? (await prisma.setting.findUnique({ where: { key } }))?.value : null;

  if (value && /^https?:\/\//i.test(value)) {
    return NextResponse.redirect(value, 307);
  }

  if (value && value.startsWith('/uploads/')) {
    const rel = value.replace(/^\/uploads\//, '');
    const parts = rel.split('/').filter((p) => p && p !== '..' && !p.includes('\\'));
    const root = uploadRoot();
    const filePath = path.join(root, ...parts);
    if (path.resolve(filePath).startsWith(path.resolve(root))) {
      try {
        const data = await readFile(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();
        return new NextResponse(new Uint8Array(data), {
          headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' },
        });
      } catch {
        /* fall through to default */
      }
    }
  }

  return NextResponse.redirect(new URL('/logo.png', req.url), 307);
}
