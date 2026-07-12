import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { prisma } from '@noc/db';
import { neighborhoodHref, resolveNeighborhoodId } from '../../../lib/geoHref';

// Legacy neighborhood URL (/explore/<cuid>) — permanently redirects (308) to the canonical
// /explore/neighborhood/<slug>--<id>. Static siblings (/explore/city|district|neighborhood)
// win over this dynamic segment, so only bare ids land here.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as 'ar' | 'en';
  return { title: locale === 'en' ? 'Explore — New Obour' : 'استكشف — العبور الجديدة' };
}

export default async function LegacyNeighborhoodRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const resolved = await resolveNeighborhoodId(param);
  if (!resolved) notFound();
  const n = await prisma.neighborhood.findUnique({
    where: { id: resolved.id },
    select: { id: true, nameAr: true, district: { select: { nameAr: true } } },
  });
  if (!n) notFound();
  permanentRedirect(neighborhoodHref(n));
}
