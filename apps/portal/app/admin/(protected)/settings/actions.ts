'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, loadSmsConfig, normalizePhone } from '@noc/auth';
import { prisma } from '@noc/db';
import { sendSms } from '@noc/sms';

type Result = { ok: true } | { ok: false; error: string };

const SMS_KEYS = ['sms_provider', 'sms_username', 'sms_password', 'sms_sender', 'sms_environment'];

export async function setSetting(key: string, value: string): Promise<Result> {
  await requirePermission('settings', 'UPDATE');
  if (!SMS_KEYS.includes(key)) return { ok: false, error: 'forbidden_key' };
  try {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value.trim() },
      create: { key, value: value.trim() },
    });
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (e) {
    console.error('setSetting failed', e);
    return { ok: false, error: 'failed' };
  }
}

export async function sendTestSms(rawPhone: string): Promise<Result> {
  await requirePermission('settings', 'UPDATE');
  const phone = normalizePhone(rawPhone);
  if (!/^\+?\d{8,15}$/.test(phone)) return { ok: false, error: 'invalid_phone' };
  const cfg = await loadSmsConfig();
  const r = await sendSms(phone, 'New Obour — اختبار / test ✅', cfg);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? 'failed' };
}
