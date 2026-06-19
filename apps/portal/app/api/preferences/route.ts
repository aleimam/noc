import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

const APPEARANCES = ['SYSTEM', 'LIGHT', 'DARK'] as const;

// Returns the signed-in customer's saved preferences (used to hydrate on login).
export async function GET() {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const pref = await prisma.customerPreference.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({
    ok: true,
    locale: pref?.locale ?? null,
    appearance: pref?.appearance ?? null,
  });
}

// Persists locale and/or appearance for the signed-in customer.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.type !== 'CUSTOMER') {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: { locale?: 'AR' | 'EN'; appearance?: (typeof APPEARANCES)[number] } = {};
  if (typeof body.locale === 'string') {
    const loc = body.locale.toLowerCase();
    if (loc === 'ar') data.locale = 'AR';
    else if (loc === 'en') data.locale = 'EN';
  }
  if (typeof body.appearance === 'string') {
    const ap = body.appearance.toUpperCase();
    if ((APPEARANCES as readonly string[]).includes(ap)) {
      data.appearance = ap as (typeof APPEARANCES)[number];
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await prisma.customerPreference.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });
  return NextResponse.json({ ok: true });
}
