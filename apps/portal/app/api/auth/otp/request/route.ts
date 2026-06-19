import { NextResponse, type NextRequest } from 'next/server';
import { requestOtp } from '@noc/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }
  const result = await requestOtp(phone);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === 'invalid_phone' ? 400 : 429 });
  }
  return NextResponse.json({ ok: true });
}
