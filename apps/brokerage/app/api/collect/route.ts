import type { NextRequest } from 'next/server';
import { handleCollect, type CollectInput } from '@noc/analytics';
import { auth } from '@noc/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Best-effort client IP behind Nginx/Cloudflare. */
function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim() || null;
  return req.headers.get('x-real-ip');
}

/** First-party analytics collector for Al Sawarey. Always returns 204. */
export async function POST(req: NextRequest): Promise<Response> {
  let input: CollectInput | null = null;
  try {
    const body = await req.text();
    if (body.length > 8192) return new Response(null, { status: 204 });
    input = JSON.parse(body) as CollectInput;
  } catch {
    return new Response(null, { status: 204 });
  }

  let userId: string | null = null;
  try {
    const u = (await auth())?.user;
    if (u && (u.type === 'CUSTOMER' || u.type === 'PARTNER')) userId = u.id ?? null;
  } catch { /* anonymous */ }

  try {
    await handleCollect(input, { ip: clientIp(req), ua: req.headers.get('user-agent'), userId });
  } catch { /* swallow */ }
  return new Response(null, { status: 204 });
}
