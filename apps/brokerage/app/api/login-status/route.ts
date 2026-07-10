import type { NextRequest } from 'next/server';
import { loginKey, loginRetryAfter } from '@noc/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES = new Set(['staff', 'customer', 'partner']);

/** Returns how many seconds a given login identifier is locked out for (0 = allowed),
 *  so the login form can show a cooldown message after too many failed attempts. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { scope, identifier } = (await req.json()) as { scope?: string; identifier?: string };
    if (!scope || !SCOPES.has(scope) || !identifier) return Response.json({ retryAfter: 0 });
    return Response.json({ retryAfter: loginRetryAfter(loginKey(scope, String(identifier))) });
  } catch {
    return Response.json({ retryAfter: 0 });
  }
}
