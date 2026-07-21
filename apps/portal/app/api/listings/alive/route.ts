import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@noc/db';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Returns the subset of the given listing ids that are visible ON THIS SITE. Powers the client
 *  «شوهدت مؤخرًا» row so it can prune dead entries from localStorage instead of rendering cards
 *  that 404.
 *
 *  The two routes stay MIRRORED in shape but must NOT share a predicate: "alive" is per-brand.
 *  New Obour serves PUBLISHED only (list, detail and the slug resolver all agree), so accepting
 *  SOLD here kept approving a stale card whose link 404s — the exact thing this endpoint exists
 *  to prevent. Al Sawarey uses its full storefront predicate instead. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`alive:${clientIp(await headers())}`, 60, 60 * 1000)) {
    return NextResponse.json({ alive: [] }, { status: 429 });
  }
  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) ids = body.ids.filter((x): x is string => typeof x === 'string').slice(0, 50);
  } catch {
    /* malformed body → empty */
  }
  if (!ids.length) return NextResponse.json({ alive: [] });
  const rows = await prisma.listing.findMany({
    // newObourVisibility() is `{ deletedAt: null }`; PUBLISHED matches /market and the detail page.
    where: { id: { in: ids }, deletedAt: null, status: 'PUBLISHED' },
    select: { id: true },
  });
  return NextResponse.json({ alive: rows.map((r) => r.id) });
}
