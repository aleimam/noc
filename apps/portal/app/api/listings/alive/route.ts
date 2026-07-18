import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@noc/db';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Returns the subset of the given listing ids that still exist and are publicly visible
 *  (not soft-deleted, status PUBLISHED/SOLD). Powers the client «شوهدت مؤخرًا» row so it can
 *  prune stale/deleted entries from its localStorage instead of rendering blank dead cards.
 *  Mirror of the brokerage route (keep both in sync). */
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
    where: { id: { in: ids }, deletedAt: null, status: { in: ['PUBLISHED', 'SOLD'] } },
    select: { id: true },
  });
  return NextResponse.json({ alive: rows.map((r) => r.id) });
}
