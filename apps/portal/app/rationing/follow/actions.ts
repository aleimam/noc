'use server';

import { getLocale } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { normalizeArabic } from '../../../lib/rationing/text';
import { beginPhoneFollow, completePhoneFollow } from '../../../lib/followAuth';

type FollowFields = {
  kind: 'FOUND' | 'WATCH';
  applicantName: string;
  plotNo?: string;
  blockNo?: string;
  originalOwner?: string;
  cityId?: string;
  sheetId?: string;
};

async function writeFollow(userId: string, f: FollowFields): Promise<void> {
  const applicantName = f.applicantName.trim();
  await prisma.rationingFollow.create({
    data: {
      userId,
      kind: f.kind,
      applicantName,
      nameNorm: normalizeArabic(applicantName),
      plotNo: f.plotNo?.trim() || null,
      blockNo: f.blockNo?.trim() || null,
      originalOwner: f.originalOwner?.trim() || null,
      cityId: f.cityId || null,
      sheetId: f.sheetId || null,
      status: f.kind === 'FOUND' ? 'matched' : 'active',
    },
  });
}

type StartResult =
  | { ok: true; status: 'done' | 'need_otp' }
  | { ok: false; error: string };

// Step 1: no login required. A signed-in customer (or a brand-new phone) is followed
// immediately; a phone that already has an account gets an OTP to confirm ownership.
export async function startFollow(input: FollowFields & { phone?: string }): Promise<StartResult> {
  if (!input.applicantName?.trim()) return { ok: false, error: 'name_required' };

  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;
  if (!sessionUserId && !input.phone?.trim()) return { ok: false, error: 'phone_required' };

  const locale = (await getLocale()) as 'ar' | 'en';
  const res = await beginPhoneFollow(input.phone ?? '', sessionUserId, locale);
  if (res.kind === 'error') return { ok: false, error: res.error };
  if (res.kind === 'otp_sent') return { ok: true, status: 'need_otp' };

  try {
    await writeFollow(res.userId, input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('startFollow write failed', e);
    return { ok: false, error: 'failed' };
  }
}

// Step 2 (existing phone only): verify the OTP, then attach the follow.
export async function confirmFollow(
  input: FollowFields & { phone: string; code: string },
): Promise<StartResult> {
  if (!input.applicantName?.trim()) return { ok: false, error: 'name_required' };
  const res = await completePhoneFollow(input.phone, input.code);
  if (!res.ok) return { ok: false, error: 'invalid_code' };
  try {
    await writeFollow(res.userId, input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('confirmFollow write failed', e);
    return { ok: false, error: 'failed' };
  }
}
