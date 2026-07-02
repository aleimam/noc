'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';

async function requireCustomer(): Promise<string | null> {
  const s = await auth();
  if (s?.user?.type !== 'CUSTOMER' || !s.user.id) return null;
  return s.user.id;
}

export type UserLandInput = {
  id?: string;
  title?: string;
  districtId?: string;
  neighborhoodId?: string;
  blockNo?: string;
  plotNo?: string;
  area?: string;
  notes?: string;
  getUpdates: boolean;
  forSale: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

// Create/update one of the customer's lands and reconcile its two side-effects:
//   getUpdates → a LandFollow (area-update alerts), forSale → a LandOffer (admin review).
export async function saveUserLand(input: UserLandInput): Promise<Result> {
  const userId = await requireCustomer();
  if (!userId) return { ok: false, error: 'auth' };

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, name: true } });
  if (!me?.phone) return { ok: false, error: 'auth' };

  const existing = input.id
    ? await prisma.userLand.findFirst({ where: { id: input.id, userId } })
    : null;
  if (input.id && !existing) return { ok: false, error: 'not_found' };

  const districtId = input.districtId || null;
  const neighborhoodId = input.neighborhoodId || null;
  const blockNo = input.blockNo?.trim() || null;
  const plotNo = input.plotNo?.trim() || null;
  const areaNum = input.area && !Number.isNaN(Number(input.area)) ? Number(input.area) : null;
  const title = input.title?.trim() || null;
  const notes = input.notes?.trim() || null;

  let landFollowId = existing?.landFollowId ?? null;
  let landOfferId = existing?.landOfferId ?? null;

  try {
    // Reconcile the "get area updates" follow.
    if (input.getUpdates && !landFollowId) {
      const lf = await prisma.landFollow.create({
        data: { userId, phone: me.phone, name: me.name, note: title, districtId, neighborhoodId },
      });
      landFollowId = lf.id;
    } else if (!input.getUpdates && landFollowId) {
      await prisma.landFollow.deleteMany({ where: { id: landFollowId } });
      landFollowId = null;
    }

    // Reconcile the "list for sale" offer (admin-reviewed).
    if (input.forSale && !landOfferId) {
      const lo = await prisma.landOffer.create({
        data: {
          mode: 'ALLOCATED',
          ownerName: me.name || me.phone,
          phone1: me.phone,
          area: areaNum,
          districtId,
          neighborhoodId,
          blockNo,
          plotNo,
          details: notes,
          userId,
        },
      });
      landOfferId = lo.id;
    } else if (!input.forSale && landOfferId) {
      // Withdraw only offers still awaiting/under review; keep the record once decided.
      await prisma.landOffer.deleteMany({ where: { id: landOfferId, status: { in: ['NEW', 'REVIEWING'] } } });
      landOfferId = null;
    }

    const data = {
      userId,
      title,
      districtId,
      neighborhoodId,
      blockNo,
      plotNo,
      area: areaNum,
      notes,
      getUpdates: input.getUpdates,
      forSale: input.forSale,
      landFollowId,
      landOfferId,
    };
    if (existing) await prisma.userLand.update({ where: { id: existing.id }, data });
    else await prisma.userLand.create({ data });

    revalidatePath('/account/lands');
    return { ok: true };
  } catch (e) {
    console.error('saveUserLand failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function deleteUserLand(id: string): Promise<Result> {
  const userId = await requireCustomer();
  if (!userId) return { ok: false, error: 'auth' };
  const land = await prisma.userLand.findFirst({ where: { id, userId } });
  if (!land) return { ok: false, error: 'not_found' };
  try {
    if (land.landFollowId) await prisma.landFollow.deleteMany({ where: { id: land.landFollowId } });
    if (land.landOfferId) {
      await prisma.landOffer.deleteMany({ where: { id: land.landOfferId, status: { in: ['NEW', 'REVIEWING'] } } });
    }
    await prisma.userLand.delete({ where: { id: land.id } });
    revalidatePath('/account/lands');
    return { ok: true };
  } catch (e) {
    console.error('deleteUserLand failed', e);
    return { ok: false, error: 'failed' };
  }
}
