import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadRoot } from '@/lib/uploads';

// Dev-only static serving of uploaded media. In production Apache serves
// /uploads/* directly via `Alias` and this route isn't hit — the authoritative hotlink
// rule lives at the edge (Apache/Cloudflare, see security.md §5). This guard mirrors it
// for any environment where Next does serve the file (F4).
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

// Block cross-site hotlinking: a Referer from another host is refused; direct opens
// (no Referer) and same-site loads are allowed, so nothing legitimate breaks.
function refererAllowed(req: NextRequest): boolean {
  const ref = req.headers.get('referer');
  if (!ref) return true;
  try {
    const refHost = new URL(ref).host;
    const allowed = new Set<string>();
    const selfHost = req.headers.get('host');
    if (selfHost) allowed.add(selfHost);
    for (const u of [process.env.PORTAL_URL, process.env.BROKERAGE_URL]) {
      if (u) {
        try {
          allowed.add(new URL(u).host);
        } catch {
          /* ignore malformed env */
        }
      }
    }
    return allowed.has(refHost);
  } catch {
    return true; // unparseable Referer — don't break legitimate loads
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!refererAllowed(req)) return new NextResponse('Forbidden', { status: 403 });
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
