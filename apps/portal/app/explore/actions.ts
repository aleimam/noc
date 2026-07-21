'use server';

import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { auth } from '@noc/auth';
import { prisma } from '@noc/db';
import { beginPhoneFollow, completePhoneFollow } from '../../lib/followAuth';
import { clientIp, rateLimit } from '../../lib/rateLimit';

/** Public unauthenticated write → per-IP quota + a global ceiling. */
async function followQuota(): Promise<boolean> {
  const ip = clientIp(await headers());
  return rateLimit(`areafollow:${ip}`, 5, 10 * 60 * 1000) && rateLimit('areafollow:global', 300, 60 * 60 * 1000);
}

/** The submitted area ids must form ONE active hierarchy. The server previously stored whatever
 *  combination it was given, so a direct call could subscribe one person to several unrelated
 *  update audiences (or to a deactivated area). */
async function validAreaTarget(f: AreaFields): Promise<boolean> {
  if (f.landId) return !!(await prisma.land.findFirst({ where: { id: f.landId }, select: { id: true } }));
  if (f.blockId) {
    const b = await prisma.block.findFirst({ where: { id: f.blockId }, select: { neighborhoodId: true } });
    if (!b) return false;
    return !f.neighborhoodId || b.neighborhoodId === f.neighborhoodId;
  }
  if (f.neighborhoodId) {
    const n = await prisma.neighborhood.findFirst({
      where: { id: f.neighborhoodId, isActive: true, district: { isActive: true } },
      select: { districtId: true },
    });
    if (!n) return false;
    return !f.districtId || n.districtId === f.districtId;
  }
  if (f.districtId) return !!(await prisma.district.findFirst({ where: { id: f.districtId, isActive: true }, select: { id: true } }));
  return false; // a follow with no target is meaningless
}

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
  if (!(await followQuota())) return { ok: false, error: 'rate_limited' };
  if (!(await validAreaTarget(input))) return { ok: false, error: 'invalid_target' };
  const session = await auth();
  // Only a CUSTOMER session auto-attaches; staff/no-session fall through to the typed phone
  // (same rule the rationing follow already uses).
  const sessionUserId = session?.user?.type === 'CUSTOMER' ? (session.user.id ?? null) : null;
  const locale = (await getLocale()) as 'ar' | 'en';
  const res = await beginPhoneFollow(input.phone, sessionUserId, locale);
  if (res.kind === 'error') return { ok: false, error: res.error };
  if (res.kind === 'otp_sent') return { ok: true, status: 'need_otp' };
  try {
    // res.phone, not the typed field — see followAuth.
    await writeAreaFollow(res.userId, res.phone, input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('startAreaFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}

// Step 2 (existing phone) — verify OTP, then attach the follow.
export async function confirmAreaFollow(input: AreaFields & { code: string }): Promise<StartResult> {
  if (!(await followQuota())) return { ok: false, error: 'rate_limited' };
  if (!(await validAreaTarget(input))) return { ok: false, error: 'invalid_target' };
  const res = await completePhoneFollow(input.phone, input.code);
  if (!res.ok) return { ok: false, error: 'invalid_code' };
  try {
    // The OTP-verified number, not the typed field.
    await writeAreaFollow(res.userId, res.phone, input);
    return { ok: true, status: 'done' };
  } catch (e) {
    console.error('confirmAreaFollow failed', e);
    return { ok: false, error: 'failed' };
  }
}
