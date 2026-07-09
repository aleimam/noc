import type { NextRequest } from 'next/server';
import { handleCollect, type CollectInput } from '@noc/analytics';
import { auth } from '@noc/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Best-effort client IP behind Nginx/Cloudflare. Prefer X-Real-IP: nginx sets it to the real
 *  connection IP (Cloudflare-aware via real_ip_header CF-Connecting-IP) and overwrites any
 *  client-supplied value, so it can't be spoofed. Fall back to the first X-Forwarded-For hop. */
function clientIp(req: NextRequest): string | null {
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim() || null;
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0]!.trim() || null : null;
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
