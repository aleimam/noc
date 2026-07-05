'use server';

import { headers } from 'next/headers';
import { auth } from '@noc/auth';
import { prisma, Prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { rateLimit, clientIp } from '../../lib/rateLimit';

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

// Cap public free-text so a hostile submitter can't bloat storage / rows.
const cap = (v: string | undefined, n: number) => {
  const s = (v ?? '').trim();
  return s ? s.slice(0, n) : null;
};

export async function createLandOffer(input: OfferInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rateLimit(`sell:${clientIp(await headers())}`, 8, 60 * 60 * 1000)) return { ok: false, error: 'rate_limited' };
  const session = await auth();
  const ownerName = cap(input.ownerName, 120);
  const phone1 = cap(input.phone1, 30);
  if (!ownerName || !phone1) return { ok: false, error: 'required' };
  if (!isValidPhone(phone1)) return { ok: false, error: 'invalid_phone' };
  if (input.phone2?.trim() && !isValidPhone(input.phone2)) return { ok: false, error: 'invalid_phone' };

  try {
    const offer = await prisma.landOffer.create({
      data: {
        mode: input.mode,
        ownerName,
        phone1,
        phone2: cap(input.phone2, 30),
        area: dec(input.area),
        originalArea: input.mode === 'ALLOCATED' ? dec(input.originalArea) : null,
        cityId: input.mode === 'SHEET' ? input.cityId || null : null,
        districtId: input.mode === 'ALLOCATED' ? input.districtId || null : null,
        neighborhoodId: input.mode === 'ALLOCATED' ? input.neighborhoodId || null : null,
        blockNo: input.mode === 'ALLOCATED' ? cap(input.blockNo, 40) : null,
        plotNo: input.mode === 'ALLOCATED' ? cap(input.plotNo, 40) : null,
        requiredPrice: dec(input.requiredPrice),
        details: cap(input.details, 4000),
        userId: session?.user?.id ?? null,
      },
    });

    // Link the uploaded (draft) photos to this offer — internal, never public.
    const ids = (input.attachmentIds ?? []).filter(Boolean).slice(0, 30);
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
