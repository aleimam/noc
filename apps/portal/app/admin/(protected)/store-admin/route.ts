import { NextResponse } from 'next/server';
import { auth, signAdminToken, getEffectivePermissions, hasPermission } from '@noc/auth';
import { prisma } from '@noc/db';

// Staff entry point: mint a short-lived signed token and hand off to alsawarey.com's
// admin-view, which reveals owner names, phone numbers and WhatsApp flags.
//
// This used to admit ANY staff type with no requirePermission call, so a support- or
// analytics-only account could walk into the owner-PII view. It now needs the same
// `owners:VIEW` grant the portal's own owner screens require.
export async function GET() {
  const session = await auth();
  const user = session?.user;
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  const loginUrl = new URL('/admin/login', process.env.PORTAL_URL || 'https://newobour.com');
  if (!user || user.type !== 'STAFF') return NextResponse.redirect(loginUrl);

  // Re-read from the DB — an offboarded account must not be able to mint a fresh token.
  const live = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, type: true, isActive: true } });
  if (!live || live.type !== 'STAFF' || !live.isActive) return NextResponse.redirect(loginUrl);
  const perms = await getEffectivePermissions(live.id);
  if (!hasPermission(perms, 'owners', 'VIEW')) {
    return NextResponse.redirect(new URL('/admin', process.env.PORTAL_URL || 'https://newobour.com'));
  }

  const token = signAdminToken(user.id);
  return NextResponse.redirect(`${base}/admin-enter?t=${encodeURIComponent(token)}`);
}
