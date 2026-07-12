import type { NextRequest } from 'next/server';
import { getSearchSuggestions } from '../../../lib/search';
import { rateLimit, clientIp } from '../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Search Intelligence S3c — autocomplete suggestions for the New Obour market search box.
// GET ?q=<partial>. Light per-IP rate limit (a typeahead fires often); always returns a shape.

export async function GET(req: NextRequest): Promise<Response> {
  if (!rateLimit(`suggest:${clientIp(req.headers)}`, 120, 60 * 1000)) return Response.json({ suggestions: [] });
  const q = (new URL(req.url).searchParams.get('q') || '').slice(0, 100);
  try {
    const suggestions = await getSearchSuggestions(q, { site: 'newobour', surface: 'market' });
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
