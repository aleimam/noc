import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@noc/db';

// Stable brand-asset URLs (/brand/logo, /brand/logo-dark, /brand/favicon) that redirect
// to the admin-uploaded file, or the bundled default. Lets the shells use a fixed src
// while the actual image is editable from the backend.
const MAP: Record<string, string> = {
  logo: 'brand_newobour_logo',
  'logo-dark': 'brand_newobour_logo_dark',
  favicon: 'brand_newobour_favicon',
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  const key = MAP[asset];
  let url = '/logo.png';
  if (key) {
    const s = await prisma.setting.findUnique({ where: { key } });
    if (s?.value) url = s.value;
  }
  return NextResponse.redirect(new URL(url, req.url), 307);
}
