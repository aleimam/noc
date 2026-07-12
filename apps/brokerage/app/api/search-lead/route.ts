import type { NextRequest } from 'next/server';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { normalizeSearch } from '../../../lib/search';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search Intelligence S3c — zero-result lead capture (Al Sawarey mirror of the portal route).
// A storefront search that returned nothing lets the visitor leave a phone + note (unmet demand).
// Public (no auth), rate-limited per IP, server-validates the phone.

type Body = { site?: unknown; surface?: unknown; query?: unknown; phone?: unknown; note?: unknown; name?: unknown };

export async function POST(req: NextRequest): Promise<Response> {
  if (!rateLimit(`search-lead:${clientIp(req.headers)}`, 8, 60 * 60 * 1000)) {
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

  const site = body?.site === 'newobour' || body?.site === 'alsawarey' ? body.site : null;
  const surface = body?.surface === 'market' || body?.surface === 'storefront' ? body.surface : null;
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const query = typeof body?.query === 'string' ? body.query.slice(0, 2000) : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 191) : '';
  if (!site || !surface || !isValidPhone(phone)) return Response.json({ ok: false, error: 'invalid' }, { status: 400 });

  try {
    await prisma.searchLead.create({
      data: {
        site,
        surface,
        query,
        normalized: normalizeSearch(query).slice(0, 191),
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
