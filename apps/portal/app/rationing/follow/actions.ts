'use server';

import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { normalizeArabic } from '../../../lib/rationing/text';

type FollowInput = {
  kind: 'FOUND' | 'WATCH';
  applicantName: string;
  plotNo?: string;
  blockNo?: string;
  originalOwner?: string;
  cityId?: string;
  sheetId?: string;
};

// Account required (#11). The customer is created on first OTP verify, so any signed-in user qualifies.
export async function createFollow(input: FollowInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'auth' };

  const applicantName = input.applicantName?.trim();
  if (!applicantName) return { ok: false, error: 'name_required' };

  try {
    await prisma.rationingFollow.create({
      data: {
        userId,
        kind: input.kind,
        applicantName,
        nameNorm: normalizeArabic(applicantName),
        plotNo: input.plotNo?.trim() || null,
        blockNo: input.blockNo?.trim() || null,
        originalOwner: input.originalOwner?.trim() || null,
        cityId: input.cityId || null,
        sheetId: input.sheetId || null,
        status: input.kind === 'FOUND' ? 'matched' : 'active',
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('createFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}
