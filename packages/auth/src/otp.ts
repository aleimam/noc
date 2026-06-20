import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@noc/db';
import { sendSms, type SmsConfig } from '@noc/sms';

const SMS_KEYS = ['sms_provider', 'sms_username', 'sms_password', 'sms_sender', 'sms_environment'];

/** Load SMS gateway config from the admin Settings table (env as fallback). */
export async function loadSmsConfig(): Promise<SmsConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: SMS_KEYS } } });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    provider: s.sms_provider || process.env.SMS_PROVIDER || 'console',
    username: s.sms_username,
    password: s.sms_password,
    sender: s.sms_sender,
    environment: s.sms_environment || '1',
  };
}

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const MAX_SENDS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000; // per 10 minutes

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? 'dev-secret';
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

/** Normalize to E.164-ish. Handles Egyptian local numbers (01xxxxxxxxx → +201xxxxxxxxx). */
export function normalizePhone(input: string): string {
  let p = (input ?? '').trim().replace(/[\s()-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = '+20' + p.slice(1);
  if (!p.startsWith('+') && p.length === 10 && p.startsWith('1')) p = '+20' + p;
  return p;
}

export type OtpRequestResult =
  | { ok: true }
  | { ok: false; error: 'invalid_phone' | 'cooldown' | 'rate_limited' };

export async function requestOtp(rawPhone: string): Promise<OtpRequestResult> {
  const phone = normalizePhone(rawPhone);
  if (!/^\+?\d{8,15}$/.test(phone)) return { ok: false, error: 'invalid_phone' };

  const now = Date.now();
  const recent = await prisma.otpCode.findMany({
    where: { phone, createdAt: { gte: new Date(now - WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent.length >= MAX_SENDS_PER_WINDOW) return { ok: false, error: 'rate_limited' };
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.otpCode.create({
    data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(now + CODE_TTL_MS) },
  });
  const cfg = await loadSmsConfig();
  await sendSms(phone, `New Obour verification code: ${code}`, cfg);
  return { ok: true };
}

export type OtpVerifyResult =
  | { ok: true; phone: string }
  | { ok: false; error: 'invalid' | 'expired' | 'too_many_attempts' };

export async function verifyOtp(rawPhone: string, code: string): Promise<OtpVerifyResult> {
  const phone = normalizePhone(rawPhone);
  const rec = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec) return { ok: false, error: 'invalid' };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, error: 'expired' };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };

  const expected = Buffer.from(rec.codeHash, 'hex');
  const actual = Buffer.from(hashCode(phone, code), 'hex');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    await prisma.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: 'invalid' };
  }
  await prisma.otpCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
  return { ok: true, phone };
}
