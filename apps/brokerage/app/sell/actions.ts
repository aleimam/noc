'use server';

import { auth } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';

export type OfferInput = {
  mode: 'SHEET' | 'ALLOCATED';
  ownerName: string;
  phone1: string;
  phone2?: string;
  area?: string;
  originalArea?: string;
  cityId?: string;
  districtId?: string;
  neighborhoodId?: string;
  blockNo?: string;
  plotNo?: string;
  requiredPrice?: string;
  details?: string;
  attachmentIds?: string[];
};

const dec = (v?: string) => {
  const s = (v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : new Prisma.Decimal(n);
};

export async function createLandOffer(input: OfferInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const ownerName = input.ownerName?.trim();
  const phone1 = input.phone1?.trim();
  if (!ownerName || !phone1) return { ok: false, error: 'required' };

  try {
    const offer = await prisma.landOffer.create({
      data: {
        mode: input.mode,
        ownerName,
        phone1,
        phone2: input.phone2?.trim() || null,
        area: dec(input.area),
        originalArea: input.mode === 'ALLOCATED' ? dec(input.originalArea) : null,
        cityId: input.mode === 'SHEET' ? input.cityId || null : null,
        districtId: input.mode === 'ALLOCATED' ? input.districtId || null : null,
        neighborhoodId: input.mode === 'ALLOCATED' ? input.neighborhoodId || null : null,
        blockNo: input.mode === 'ALLOCATED' ? input.blockNo?.trim() || null : null,
        plotNo: input.mode === 'ALLOCATED' ? input.plotNo?.trim() || null : null,
        requiredPrice: dec(input.requiredPrice),
        details: input.details?.trim() || null,
        userId: session?.user?.id ?? null,
      },
    });

    // Link the uploaded (draft) photos to this offer — internal, never public.
    const ids = (input.attachmentIds ?? []).filter(Boolean);
    if (ids.length) {
      await prisma.attachment.updateMany({
        where: { id: { in: ids }, ownerType: null },
        data: { ownerType: 'LandOffer', ownerId: offer.id },
      });
    }
    return { ok: true };
  } catch (e) {
    console.error('createLandOffer failed', e);
    return { ok: false, error: 'failed' };
  }
}
