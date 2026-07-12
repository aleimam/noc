import type { NextRequest } from 'next/server';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { normalizeSearch } from '../../../lib/search';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search Intelligence S3c — zero-result lead capture. A market/storefront search that returned
// nothing lets the visitor leave a phone + note; we store it as unmet-demand for staff to work.
// Public (no auth), rate-limited per IP, server-validates the phone.

type Body = { site?: unknown; surface?: unknown; query?: unknown; phone?: unknown; note?: unknown; name?: unknown; website?: unknown };

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // same person re-submitting the same search: keep one

export async function POST(req: NextRequest): Promise<Response> {
  // Per-IP cap + a global hourly ceiling (in-memory limits reset on reload; the ceiling bounds
  // total damage from a multi-IP flood between reloads).
  if (!rateLimit(`search-lead:${clientIp(req.headers)}`, 8, 60 * 60 * 1000) || !rateLimit('search-lead:global', 120, 60 * 60 * 1000)) {
    return Response.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  let body: Body | null = null;
  try {
    const text = await req.text();
    if (text.length > 4096) return Response.json({ ok: false }, { status: 400 });
    body = JSON.parse(text) as Body;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Honeypot: the form renders a hidden "website" field humans never fill. Bots that autofill
  // every field trip it — answer ok so they don't adapt, store nothing.
  if (typeof body?.website === 'string' && body.website.trim() !== '') return Response.json({ ok: true });

  const site = body?.site === 'newobour' || body?.site === 'alsawarey' ? body.site : null;
  const surface = body?.surface === 'market' || body?.surface === 'storefront' ? body.surface : null;
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 2000) : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 191) : '';
  // query required: the form only appears after a real zero-result search.
  if (!site || !surface || !query || !isValidPhone(phone)) return Response.json({ ok: false, error: 'invalid' }, { status: 400 });

  try {
    const normalized = normalizeSearch(query).slice(0, 191);
    // Dedupe: same (site, normalized, phone) within 24h → answer ok, don't add another row.
    const dup = await prisma.searchLead.findFirst({
      where: { site, normalized, phone: phone.slice(0, 32), createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
      select: { id: true },
    });
    if (dup) return Response.json({ ok: true });
    await prisma.searchLead.create({
      data: {
        site,
        surface,
        query,
        normalized,
        phone: phone.slice(0, 32),
        name: name || null,
        note: note || null,
      },
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
