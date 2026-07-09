'use server';

import { headers } from 'next/headers';
import { prisma } from '@noc/db';
import { isValidPhone } from '@noc/config';
import { rateLimit, clientIp } from '../../lib/rateLimit';

export type PartnerApplyInput = {
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  businessType?: string;
  areas?: string;
  message?: string;
};

type Result = { ok: true } | { ok: false; error: 'rate' | 'name' | 'phone' | 'failed' };

const cap = (s: string | undefined, n: number) => ((s ?? '').trim().slice(0, n) || null);

/** Public "become a partner" submission — anyone can send one; staff review it in the admin. */
export async function submitPartnerApplication(input: PartnerApplyInput): Promise<Result> {
  const ip = clientIp(await headers());
  if (!rateLimit(`partner-apply:${ip}`, 3, 10 * 60 * 1000)) return { ok: false, error: 'rate' };

  const name = (input.name ?? '').trim();
  const phone = (input.phone ?? '').trim();
  if (name.length < 2) return { ok: false, error: 'name' };
  if (!isValidPhone(phone)) return { ok: false, error: 'phone' };

  try {
    await prisma.partnerApplication.create({
      data: {
        name: name.slice(0, 120),
        businessName: cap(input.businessName, 120),
        phone: phone.slice(0, 30),
        email: cap(input.email, 160),
        businessType: cap(input.businessType, 60),
        areas: cap(input.areas, 190),
        message: cap(input.message, 2000),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
