import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@noc/db';
import { requestOtp, normalizePhone } from '@noc/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';

/** Send a login OTP to a PARTNER account resolved by identifier (username/email/phone).
 *  The code always goes to the account's phone via SMS; email delivery is not enabled
 *  yet (accounts without a phone use their password). */
export async function POST(req: NextRequest) {
  if (!rateLimit(`potp:${clientIp(req.headers)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const ident = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  if (!ident) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 400 });

  const lower = ident.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      type: 'PARTNER',
      isActive: true,
      ownerId: { not: null },
      OR: [{ username: lower }, { email: lower }, { phone: ident }, { phone: normalizePhone(ident) }],
    },
    select: { phone: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  if (!user.phone) return NextResponse.json({ ok: false, error: 'no_phone' }, { status: 400 });

  const result = await requestOtp(user.phone, 'ar');
  if (!result.ok) return NextResponse.json(result, { status: 429 });
  // Mask the destination so the login page can show where the code went.
  const masked = user.phone.replace(/^(.*)(\d{3})$/, (_, a: string, tail: string) => '•'.repeat(Math.max(a.length - 1, 3)) + tail);
  return NextResponse.json({ ok: true, sentTo: masked });
}
