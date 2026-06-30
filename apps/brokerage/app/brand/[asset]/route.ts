import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@noc/db';

// Stable brand-asset URLs for ALSWARY, editable from the New Obour backend.
const MAP: Record<string, string> = {
  logo: 'brand_alsawarey_logo',
  'logo-dark': 'brand_alsawarey_logo_dark',
  favicon: 'brand_alsawarey_favicon',
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
