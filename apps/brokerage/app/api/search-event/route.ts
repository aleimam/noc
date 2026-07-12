import type { NextRequest } from 'next/server';
import { prisma } from '@noc/db';
import { normalizeSearch } from '../../../lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search Intelligence (Phase S2) — heuristic selection + conversion attribution for the
// Al Sawarey storefront. Mirror of apps/portal/app/api/search-event/route.ts (each app must
// own its own route so the beacon posts same-origin). No session join: sessionId is
// client-side only, so we attribute by (site + same normalized query / same opened listing +
// recency). Public signal, no auth. ALWAYS returns { ok:true } — a failed beacon must never
// surface an error to the visitor.

const SELECT_WINDOW_MS = 30 * 60 * 1000; // opened a result within 30 min of the search
const CONVERT_WINDOW_MS = 2 * 60 * 60 * 1000; // contacted within 2 h of opening the result

type Body =
  | { kind?: 'select'; site?: unknown; query?: unknown; listingId?: unknown }
  | { kind?: 'convert'; site?: unknown; listingId?: unknown };

const ok = () => Response.json({ ok: true });

export async function POST(req: NextRequest): Promise<Response> {
  let body: Body | null = null;
  try {
    const text = await req.text();
    if (text.length > 4096) return ok();
    body = JSON.parse(text) as Body;
  } catch {
    return ok();
  }

  try {
    if (!body || typeof body !== 'object') return ok();
    const site = body.site === 'newobour' || body.site === 'alsawarey' ? body.site : null;
    const listingId = typeof body.listingId === 'string' ? body.listingId.trim().slice(0, 191) : '';
    if (!site || !listingId) return ok();

    if (body.kind === 'select') {
      const raw = typeof body.query === 'string' ? body.query.slice(0, 2000) : '';
      const normalized = normalizeSearch(raw).slice(0, 191);
      if (!normalized) return ok();
      const row = await prisma.searchLog.findFirst({
        where: {
          site,
          normalized,
          selectedListingId: null,
          createdAt: { gte: new Date(Date.now() - SELECT_WINDOW_MS) },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (row) await prisma.searchLog.update({ where: { id: row.id }, data: { selectedListingId: listingId } });
    } else if (body.kind === 'convert') {
      const row = await prisma.searchLog.findFirst({
        where: {
          site,
          selectedListingId: listingId,
          converted: false,
          createdAt: { gte: new Date(Date.now() - CONVERT_WINDOW_MS) },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (row) await prisma.searchLog.update({ where: { id: row.id }, data: { converted: true } });
    }
  } catch {
    /* never throw to the client — attribution is best-effort */
  }
  return ok();
}
