import { NextResponse } from 'next/server';
import { auth, signAdminToken } from '@noc/auth';

// Staff entry point: mint a short-lived signed token and hand off to alsawarey.com's
// admin-view, which reveals owner details. Any active STAFF may use it.
export async function GET() {
  const session = await auth();
  const user = session?.user;
  const base = (process.env.BROKERAGE_URL || 'https://alsawarey.com').replace(/\/$/, '');
  if (!user || user.type !== 'STAFF') {
    return NextResponse.redirect(new URL('/admin/login', process.env.PORTAL_URL || 'http://localhost:3001'));
  }
  const token = signAdminToken(user.id);
  return NextResponse.redirect(`${base}/admin-enter?t=${encodeURIComponent(token)}`);
}
