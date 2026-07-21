import type { NextRequest } from 'next/server';
import { handleCollect, type CollectInput } from '@noc/analytics';
import { auth } from '@noc/auth';
import { rateLimit } from '../../../lib/rateLimit';

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
  // MIRRORED with the portal route — see the note there. 60/min/IP + a global ceiling; still
  // 204 either way so the visitor never sees analytics throttling.
  const ip = clientIp(req);
  if (!rateLimit(`collect:${ip ?? 'unknown'}`, 60, 60_000)) return new Response(null, { status: 204 });
  if (!rateLimit('collect:global', 6000, 60_000)) return new Response(null, { status: 204 });

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
    // `site` is server-trusted — this process IS Al Sawarey. Never take it from the payload.
    await handleCollect(input, { ip, ua: req.headers.get('user-agent'), userId, site: 'alsawarey' });
  } catch { /* swallow */ }
  return new Response(null, { status: 204 });
}
