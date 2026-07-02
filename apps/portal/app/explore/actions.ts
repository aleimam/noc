'use server';

import { getLocale } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { beginPhoneFollow, completePhoneFollow } from '../../lib/followAuth';

type AreaFields = {
  name?: string;
  phone: string;
  note?: string;
  districtId?: string;
  neighborhoodId?: string;
  blockId?: string;
  landId?: string;
};

async function writeAreaFollow(userId: string, phone: string, f: AreaFields): Promise<void> {
  await prisma.landFollow.create({
    data: {
      phone,
      name: f.name?.trim() || null,
      note: f.note?.trim() || null,
      userId,
      districtId: f.districtId ?? null,
      neighborhoodId: f.neighborhoodId ?? null,
      blockId: f.blockId ?? null,
      landId: f.landId ?? null,
    },
  });
}

type StartResult = { ok: true; status: 'done' | 'need_otp' } | { ok: false; error: string };

// Step 1 — no login required. New phone → account + follow now; existing phone → OTP.
export async function startAreaFollow(input: AreaFields): Promise<StartResult> {
  if (!input.phone?.trim()) return { ok: false, error: 'phone_required' };
  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;
  const locale = (await getLocale()) as 'ar' | 'en';
  const res = await beginPhoneFollow(input.phone, sessionUserId, locale);
  if (res.kind === 'error') return { ok: false, error: res.error };
  if (res.kind === 'otp_sent') return { ok: true, status: 'need_otp' };
  try {
    await writeAreaFollow(res.userId, input.phone.trim(), input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('startAreaFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}

// Step 2 (existing phone) — verify OTP, then attach the follow.
export async function confirmAreaFollow(input: AreaFields & { code: string }): Promise<StartResult> {
  const res = await completePhoneFollow(input.phone, input.code);
  if (!res.ok) return { ok: false, error: 'invalid_code' };
  try {
    await writeAreaFollow(res.userId, input.phone.trim(), input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('confirmAreaFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}
