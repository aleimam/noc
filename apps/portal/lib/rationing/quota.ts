import { cookies, headers } from 'next/headers';
import { auth } from '@noc/auth';
import { rateLimit, clientIp } from '../rateLimit';
import { getSecurityGates } from '../security';

const HOUR = 60 * 60 * 1000;

export type QuotaResult = {
  /** false → the browser/account is over its hourly budget; show the limit card. */
  ok: boolean;
  /** HIGH break-glass: scans + maps require login. */
  loginWall: boolean;
  maxResults: number;
  loggedIn: boolean;
};

/**
 * Meter one rationing event (a page-1 search, or opening a record) against the New-Obour
 * anti-scrape quota. Call ONCE per counted event; pass count=false to read the posture
 * without consuming budget. Anonymous visitors are metered per browser (nob_v cookie) with a
 * generous per-IP ceiling on top (CGNAT-safe); logged-in users get a higher per-account
 * budget. See security.md §3.
 */
export async function consumeRationingQuota(count: boolean): Promise<QuotaResult> {
  const gates = await getSecurityGates();
  const session = await auth();
  const loggedIn = !!session?.user;
  if (!count) return { ok: true, loginWall: gates.loginWall, maxResults: gates.maxResults, loggedIn };

  let ok: boolean;
  if (loggedIn) {
    ok = rateLimit(`rn:u:${session.user.id}`, gates.userPerHour, HOUR);
  } else {
    const [c, h] = [await cookies(), await headers()];
    const ip = clientIp(h);
    const vid = c.get('nob_v')?.value || `ip:${ip}`;
    // Per-browser budget first; the per-IP ceiling only matters when it's exceeded (&&).
    const okBrowser = rateLimit(`rn:v:${vid}`, gates.anonPerHour, HOUR);
    ok = okBrowser && rateLimit(`rn:ip:${ip}`, gates.ipCeilingPerHour, HOUR);
  }
  return { ok, loginWall: gates.loginWall, maxResults: gates.maxResults, loggedIn };
}
