import { NextResponse, type NextRequest } from 'next/server';
import { requestOtp } from '@noc/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Per-IP cap (on top of the per-phone cap inside requestOtp) — F1/F8.
  if (!rateLimit(`otp:${clientIp(req.headers)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }
  // Send the OTP in the language the customer is viewing the site in:
  // prefer the value the login form sends, fall back to the NEXT_LOCALE cookie, else Arabic.
  const fromBody = body?.locale === 'en' || body?.locale === 'ar' ? body.locale : null;
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'ar';
  const locale = (fromBody ?? cookieLocale) as 'ar' | 'en';
  const result = await requestOtp(phone, locale);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === 'invalid_phone' ? 400 : 429 });
  }
  return NextResponse.json({ ok: true });
}
