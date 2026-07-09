import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@noc/db';
import { sendSms, type SmsConfig } from '@noc/sms';
import { sendMail, type MailConfig } from '@noc/mail';
import { isValidPhone, isValidEmail } from '@noc/config';
import { appSecret } from './secret';

const SMS_KEYS = ['sms_provider', 'sms_username', 'sms_password', 'sms_sender', 'sms_environment'];
const MAIL_KEYS = ['mail_provider', 'mail_host', 'mail_port', 'mail_from', 'mail_user', 'mail_pass', 'mail_secure'];

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

/** Load mail transport config from the admin Settings table (env fallback). Defaults to the
 *  local Postfix relay on 127.0.0.1:25, which is live in production (see mail-deliverability). */
export async function loadMailConfig(): Promise<MailConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: MAIL_KEYS } } });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    provider: s.mail_provider || process.env.MAIL_PROVIDER || 'smtp',
    host: s.mail_host || process.env.MAIL_HOST || '127.0.0.1',
    port: Number(s.mail_port || process.env.MAIL_PORT || 25),
    from: s.mail_from || process.env.MAIL_FROM || undefined,
    user: s.mail_user || process.env.MAIL_USER || undefined,
    pass: s.mail_pass || process.env.MAIL_PASS || undefined,
    secure: (s.mail_secure || process.env.MAIL_SECURE) === 'true',
  };
}

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const MAX_SENDS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000; // per 10 minutes

function hashCode(phone: string, code: string): string {
  return createHmac('sha256', appSecret()).update(`${phone}:${code}`).digest('hex');
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
  | { ok: false; error: 'invalid_phone' | 'invalid_email' | 'cooldown' | 'rate_limited' };

/** Single-SMS OTP text in the customer's website language (kept well under 65 chars). */
function otpMessage(code: string, locale: 'ar' | 'en'): string {
  return locale === 'en'
    ? `New Obour verification code: ${code}`
    : `العبور الجديد - رمز التحقق: ${code}`;
}

/** OTP email content (bilingual, big code — our users are low-tech, often on a relative's phone). */
function otpEmail(code: string, locale: 'ar' | 'en'): { subject: string; text: string; html: string } {
  const ar = locale === 'ar';
  const subject = ar ? `رمز الدخول: ${code} — العبور الجديد` : `Your login code: ${code} — New Obour`;
  const text = ar
    ? `رمز الدخول الخاص بك هو: ${code}\nصالح لمدة 5 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.\n\nالعبور الجديد`
    : `Your login code is: ${code}\nValid for 5 minutes. If you didn't request it, ignore this message.\n\nNew Obour`;
  const dir = ar ? 'rtl' : 'ltr';
  const html =
    `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;text-align:center">` +
    `<p style="font-size:16px;color:#334">${ar ? 'رمز الدخول الخاص بك' : 'Your login code'}</p>` +
    `<p style="font-size:40px;font-weight:bold;letter-spacing:8px;color:#c39a3f;margin:12px 0">${code}</p>` +
    `<p style="font-size:13px;color:#889">${ar ? 'صالح لمدة 5 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.' : "Valid for 5 minutes. If you didn't request it, ignore this message."}</p>` +
    `<p style="font-size:13px;color:#c39a3f;font-weight:bold;margin-top:20px">${ar ? 'العبور الجديد' : 'New Obour'}</p></div>`;
  return { subject, text, html };
}

/** Generate + store a code for an opaque destination string (phone or email). Enforces the
 *  shared cooldown / rate window keyed on that destination. */
async function createOtp(dest: string): Promise<{ ok: true; code: string } | { ok: false; error: 'cooldown' | 'rate_limited' }> {
  const now = Date.now();
  const recent = await prisma.otpCode.findMany({
    where: { phone: dest, createdAt: { gte: new Date(now - WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent.length >= MAX_SENDS_PER_WINDOW) return { ok: false, error: 'rate_limited' };
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return { ok: false, error: 'cooldown' };
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.otpCode.create({
    data: { phone: dest, codeHash: hashCode(dest, code), expiresAt: new Date(now + CODE_TTL_MS) },
  });
  return { ok: true, code };
}

export async function requestOtp(rawPhone: string, locale: 'ar' | 'en' = 'ar'): Promise<OtpRequestResult> {
  // Enforce the shared phone rule (11-digit 01… or international +…) on the raw input.
  if (!isValidPhone(rawPhone)) return { ok: false, error: 'invalid_phone' };
  const phone = normalizePhone(rawPhone);
  const r = await createOtp(phone);
  if (!r.ok) return r;
  await sendSms(phone, otpMessage(r.code, locale), await loadSmsConfig());
  return { ok: true };
}

/** Email OTP — same code machinery, keyed on the (lower-cased) address, delivered by email. */
export async function requestEmailOtp(rawEmail: string, locale: 'ar' | 'en' = 'ar'): Promise<OtpRequestResult> {
  const email = (rawEmail ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };
  const r = await createOtp(email);
  if (!r.ok) return r;
  const { subject, text, html } = otpEmail(r.code, locale);
  await sendMail({ to: email, subject, text, html }, await loadMailConfig());
  return { ok: true };
}

export type OtpVerifyResult =
  | { ok: true; phone: string }
  | { ok: false; error: 'invalid' | 'expired' | 'too_many_attempts' };

/** Check + consume a code for an opaque destination (phone or email). */
async function checkOtp(dest: string, code: string): Promise<OtpVerifyResult> {
  const rec = await prisma.otpCode.findFirst({
    where: { phone: dest, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec) return { ok: false, error: 'invalid' };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, error: 'expired' };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };

  const expected = Buffer.from(rec.codeHash, 'hex');
  const actual = Buffer.from(hashCode(dest, code), 'hex');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    await prisma.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: 'invalid' };
  }
  await prisma.otpCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });
  return { ok: true, phone: dest };
}

export async function verifyOtp(rawPhone: string, code: string): Promise<OtpVerifyResult> {
  return checkOtp(normalizePhone(rawPhone), code);
}

export async function verifyEmailOtp(rawEmail: string, code: string): Promise<OtpVerifyResult> {
  return checkOtp((rawEmail ?? '').trim().toLowerCase(), code);
}
