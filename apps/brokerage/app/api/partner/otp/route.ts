import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@noc/db';
import { requestOtp, requestEmailOtp, normalizePhone, currentSite, ownerAllowsSite } from '@noc/auth';
import { rateLimit, clientIp } from '../../../../lib/rateLimit';

/** Mask an email as a•••@domain.com so the login page can show where the code went. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user!.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(user!.length - 1, 2))}@${domain}`;
}

/** Send a login OTP to a PARTNER account resolved by identifier (username/email/phone).
 *  Gated by this app's site (NOC_SITE=alsawarey) — reveals nothing if not enabled for it. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`potp:${clientIp(req.headers)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const ident = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  const channel = body?.channel === 'email' ? 'email' : 'sms';
  if (!ident) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 400 });

  const lower = ident.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      type: 'PARTNER',
      isActive: true,
      ownerId: { not: null },
      OR: [{ username: lower }, { email: lower }, { phone: ident }, { phone: normalizePhone(ident) }],
    },
    select: { phone: true, email: true, owner: { select: { siteNewObour: true, siteAlsawary: true } } },
  });
  if (!user || !ownerAllowsSite(user.owner, currentSite())) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (channel === 'email') {
    if (!user.email) return NextResponse.json({ ok: false, error: 'no_email' }, { status: 400 });
    const result = await requestEmailOtp(user.email, 'ar');
    if (!result.ok) return NextResponse.json(result, { status: 429 });
    return NextResponse.json({ ok: true, sentTo: maskEmail(user.email), channel: 'email' });
  }

  if (!user.phone) return NextResponse.json({ ok: false, error: 'no_phone' }, { status: 400 });
  const result = await requestOtp(user.phone, 'ar');
  if (!result.ok) return NextResponse.json(result, { status: 429 });
  const masked = user.phone.replace(/^(.*)(\d{3})$/, (_, a: string, tail: string) => '•'.repeat(Math.max(a.length - 1, 3)) + tail);
  return NextResponse.json({ ok: true, sentTo: masked, channel: 'sms' });
}
