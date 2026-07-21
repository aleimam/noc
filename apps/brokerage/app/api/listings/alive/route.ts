import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@noc/db';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { STOREFRONT_STATUS } from '@/lib/listings';

export const dynamic = 'force-dynamic';

/** Returns the subset of the given listing ids that are visible ON THIS SITE. Powers the client
 *  «شوهدت مؤخرًا» row so it can prune dead entries from localStorage instead of rendering cards
 *  that 404.
 *
 *  MIRRORED in shape with the portal route, but deliberately NOT the same predicate — "alive" is
 *  per-brand. The old shared `PUBLISHED|SOLD + deletedAt` rule ignored Al Sawarey's Type/Purpose
 *  allow-list and partner/toggle gates, so a listing hidden from the storefront still validated
 *  and its stale card kept linking to a 404. */
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
    // The SAME predicate the catalogue and detail pages use (status + Type/Purpose allow-list +
    // partner/showOnBrokerage gates), so "alive" can never disagree with what the site serves.
    where: { id: { in: ids }, deletedAt: null, ...STOREFRONT_STATUS },
    select: { id: true },
  });
  return NextResponse.json({ alive: rows.map((r) => r.id) });
}
